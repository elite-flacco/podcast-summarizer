# Podcast Summarizer

Automated process that pulls your YouTube podcasts, transcribes them, and drops AI-generated summaries into a Google Doc.

## Overview

This worker automatically:
- Fetches new videos from your configured YouTube channels
- Retrieves video transcripts
- Generates AI summaries using GPT-5
- Syncs everything to a Google Docs document

## Features

- **Automated Daily Sync**: Runs via GitHub Actions at 6 AM UTC daily
- **Single-User Model**: Fork and configure with your own credentials
- **Smart Caching**: Stores data in Supabase to avoid regenerating summaries
- **Formatted Output**: Creates a well-structured Google Doc with channel sections
- **Privacy-Friendly**: Your personal channel list stays private (gitignored)

## Prerequisites

- Node.js 20+
- Supabase account (free tier is sufficient)
- YouTube Data API v3 key (free)
- OpenAI API key (GPT-5 access required)
- Google Cloud service account with Docs API access (free)

## Setup

### 1. Fork/Clone the Repository

```bash
git clone https://github.com/your-username/pod-worker
cd pod-worker
npm install
```

### 2. Configure Channels

Pick one of these approaches:

- **Recommended for GitHub Actions/public repo**: set `CHANNELS_JSON` (or `CHANNELS_JSON_BASE64`) in your `.env` and in GitHub Secrets. Example:

  ```bash
  CHANNELS_JSON='{"channels":[{"id":"UCBJycsmduvYEL83R_U4JriQ","name":"Lex Fridman Podcast","enabled":true}]}'
  ```

- **Local file for development**: copy the example file and edit it:

  ```bash
  cp config/channels.example.json config/channels.json
  ```

  Then edit `config/channels.json` with your channels. The file is gitignored so it stays private. You can remove the entry from `.gitignore` if you intend to commit it—in that case you don’t need to set `CHANNELS_JSON`/`CHANNELS_JSON_BASE64` in GitHub secrets.

To find a channel ID:
1. Go to the channel's YouTube page
2. View page source (Ctrl+U)
3. Search for `"channelId"`

### 3. Set Up Supabase Database

1. **Create Supabase Account**:
   - Go to [supabase.com](https://supabase.com/)
   - Click "Start your project"
   - Sign up with GitHub or email

2. **Create New Project**:
   - Click "New Project"
   - Choose your organization (or create one)
   - Project Name: "pod-worker" (or similar)
   - Database Password: Generate a strong password and save it
   - Region: Choose closest to you
   - Click "Create new project"
   - Wait 2-3 minutes for project to set up

3. **Get Project Credentials**:
   - Go to Project Settings (gear icon) → API
   - Copy **Project URL** (starts with `https://xxx.supabase.co`)
   - Copy **service_role key** (under "Project API keys" → "service_role" → click eye icon to reveal)
   - ⚠️ **Important**: Use `service_role` key, NOT the `anon` key (worker needs full database access)

4. **Set Up Database Schema**:
   - Go to SQL Editor (left sidebar)
   - Click "New query"
   - Copy the contents of `schema.sql` from this repo, or use the schema below:

   <details>
   <summary>Click to expand database schema</summary>

   ```sql
   -- Pod Worker Database Schema
   -- This is a minimal schema for the worker - only includes tables needed for operation

   -- Enable UUID extension
   CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

   -- Channels table (stores YouTube channel metadata)
   CREATE TABLE channels (
     id TEXT PRIMARY KEY,
     title TEXT NOT NULL,
     description TEXT,
     thumbnail_url TEXT,
     subscriber_count TEXT,
     channel_summary TEXT,
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
   );

   -- Videos table (stores YouTube video metadata)
   CREATE TABLE videos (
     id TEXT PRIMARY KEY,
     channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
     title TEXT NOT NULL,
     description TEXT,
     published_at TIMESTAMPTZ NOT NULL,
     thumbnail_url TEXT,
     duration TEXT,
     duration_minutes INTEGER,
     has_transcript BOOLEAN NOT NULL DEFAULT false,
     transcript_fetched_at TIMESTAMPTZ,
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
   );

   -- Transcripts table (stores full video transcripts)
   CREATE TABLE transcripts (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
     content TEXT NOT NULL,
     language TEXT NOT NULL DEFAULT 'en',
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     UNIQUE(video_id)
   );

   -- Summaries table (stores AI-generated summaries)
   CREATE TABLE summaries (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
     summary TEXT NOT NULL,
     key_topics TEXT[] NOT NULL DEFAULT '{}',
     highlights TEXT[] NOT NULL DEFAULT '{}',
     model TEXT NOT NULL DEFAULT 'gpt-5',
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     UNIQUE(video_id)
   );

   -- Indexes for performance
   CREATE INDEX idx_videos_channel_id ON videos(channel_id);
   CREATE INDEX idx_videos_published_at ON videos(published_at DESC);
   CREATE INDEX idx_transcripts_video_id ON transcripts(video_id);
   CREATE INDEX idx_summaries_video_id ON summaries(video_id);

   -- Updated at trigger function
   CREATE OR REPLACE FUNCTION update_updated_at_column()
   RETURNS TRIGGER AS $$
   BEGIN
     NEW.updated_at = NOW();
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql;

   -- Apply updated_at triggers
   CREATE TRIGGER update_channels_updated_at BEFORE UPDATE ON channels
     FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

   CREATE TRIGGER update_videos_updated_at BEFORE UPDATE ON videos
     FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

   CREATE TRIGGER update_summaries_updated_at BEFORE UPDATE ON summaries
     FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

   -- Row Level Security (RLS) policies
   -- Note: The worker uses service_role key which bypasses ALL RLS policies
   -- RLS is enabled for security best practices, but policies are minimal since only service_role accesses this DB
   ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
   ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
   ALTER TABLE transcripts ENABLE ROW LEVEL SECURITY;
   ALTER TABLE summaries ENABLE ROW LEVEL SECURITY;

   -- Allow public read access (useful for Supabase dashboard viewing)
   CREATE POLICY "Public read access" ON channels FOR SELECT USING (true);
   CREATE POLICY "Public read access" ON videos FOR SELECT USING (true);
   CREATE POLICY "Public read access" ON transcripts FOR SELECT USING (true);
   CREATE POLICY "Public read access" ON summaries FOR SELECT USING (true);
   ```
   </details>

   - Paste the schema into the query editor
   - Click "Run" (or press Ctrl+Enter)
   - Verify all tables were created: Check "Table Editor" in left sidebar

5. **Verify Setup**:
   - Go to Table Editor
   - You should see tables: `channels`, `videos`, `transcripts`, `summaries`

**Note**: The worker uses the `service_role` key which bypasses Row Level Security (RLS), so it can read/write all tables without user authentication.

### 4. Get YouTube API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one:
   - Click "Select a project" → "New Project"
   - Name it "Pod Worker" (or similar)
   - Click "Create"
3. Enable **YouTube Data API v3**:
   - Go to "APIs & Services" → "Library"
   - Search for "YouTube Data API v3"
   - Click on it, then click "Enable"
4. Create API Key:
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "API Key"
   - Copy the generated API key
   - (Optional but recommended) Click "Restrict Key":
     - Under "API restrictions", select "Restrict key"
     - Select "YouTube Data API v3"
     - Click "Save"

**Note**: YouTube API has a free quota of 10,000 units/day. This worker uses ~120 units/day for 10 channels, so you're well within limits.

### 5. Get OpenAI API Key

1. Go to [platform.openai.com](https://platform.openai.com/)
2. Sign up or log in to your account
3. Go to [API Keys](https://platform.openai.com/api-keys)
4. Click "Create new secret key"
5. Name it "pod-worker" (or similar)
6. Copy the key immediately (you won't see it again!)
7. Save it securely

**Important Notes**:
- **Default model**: Uses GPT-5 (`gpt-5-mini`). Override with `OPENAI_MODEL` (e.g., `gpt-4o`) if you don't have GPT-5 access.
- **Max tokens**: Override with `OPENAI_MAX_OUTPUT_TOKENS` (defaults to `100000`).
- **Cost Estimate**: ~$25-50/month for 50 episodes (depends on transcript length)
- **Add Credits**: Go to Settings and Billing to add credits/payment method

### 6. Set Up Google Cloud Service Account

1. In the same Google Cloud project
2. Enable **Google Docs API**:
   - Go to "APIs & Services" → "Library"
   - Search for "Google Docs API"
   - Click on it, then click "Enable"
3. Create Service Account:
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "Service Account"
   - Name: `pod-worker`
   - Click "Create and Continue"
   - Skip roles/permissions (click "Continue" then "Done")
4. Create Key for Service Account:
   - Click on the service account you just created
   - Go to "Keys" tab
   - Click "Add Key" → "Create new key"
   - Select "JSON" format
   - Click "Create"
5. A JSON file will download. Open it and extract:
   - `client_email` (looks like: pod-worker@project-name.iam.gserviceaccount.com)
   - `private_key` (starts with: -----BEGIN PRIVATE KEY-----)

### 7. Create Google Doc

1. Create a new Google Doc: "My Podcasts"
2. Share it with the service account email (Editor access)
3. Copy the document ID from the URL:
   ```
   https://docs.google.com/document/d/DOCUMENT_ID/edit
   ```

### 8. Configure Environment Variables

Create `.env` file (copy from `.env.example`):

```bash
# Supabase
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# YouTube API
YOUTUBE_API_KEY=your-youtube-api-key

# OpenAI
OPENAI_API_KEY=your-openai-api-key
OPENAI_MODEL=gpt-5-mini
OPENAI_MAX_OUTPUT_TOKENS=100000

# Google Docs
GOOGLE_DOCS_DOCUMENT_ID=your-document-id
GOOGLE_DOCS_CLIENT_EMAIL=pod-worker@project.iam.gserviceaccount.com
GOOGLE_DOCS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Processing
DAYS_TO_LOOK_BACK=30
MAX_RESULTS_PER_CHANNEL=10

# Channels (choose one)
# CHANNELS_JSON='{"channels":[{"id":"UCBJycsmduvYEL83R_U4JriQ","name":"Lex Fridman Podcast","enabled":true}]}'
# CHANNELS_JSON_BASE64=eyJjaGFubmVscyI6W3siaWQiOiJVQ0JKeWNzbWR1dllFTDgzUl9VNUpyaVEiLCJuYW1lIjoiTGV4IEZyaWRtYW4gUG9kY2FzdCIsImVuYWJsZWQiOnRydWV9XX0=
```

### 9. Test Locally

```bash
npm run dev
```

This will:
- Fetch videos from your configured channels
- Generate summaries for new videos
- Update your Google Doc

### 10. Deploy to GitHub Actions

1. **Initialize Git** (if not already):
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   ```

2. **Push to GitHub**:
   ```bash
   git remote add origin https://github.com/your-username/pod-worker
   git push -u origin main
   ```

   **Important**: Your `channels.json` will NOT be pushed (it's gitignored). Only `channels.example.json` is public.

3. **Add GitHub Secrets**:
   - Go to Settings > Secrets and variables > Actions
   - Add repository secrets:
     - `CHANNELS_JSON` (or `CHANNELS_JSON_BASE64`)
     - `SUPABASE_URL`
     - `SUPABASE_SERVICE_ROLE_KEY`
     - `YOUTUBE_API_KEY`
     - `OPENAI_API_KEY`
     - `OPENAI_MODEL` (optional)
     - `OPENAI_MAX_OUTPUT_TOKENS` (optional)
     - `GOOGLE_DOCS_DOCUMENT_ID`
     - `GOOGLE_DOCS_CLIENT_EMAIL`
     - `GOOGLE_DOCS_PRIVATE_KEY`

4. **Enable GitHub Actions** in repository settings

5. **Trigger manually** via Actions tab or wait for daily cron

### 11. Keeping Your Channels Private

**What's Public**:
- All code
- `channels.example.json` with example channels
- README and documentation

**What Stays Private**:
- Your channel list via `CHANNELS_JSON`/`CHANNELS_JSON_BASE64` secrets (or a local `channels.json`, which is gitignored unless you choose to remove it)
- Your `.env` file (gitignored)
- GitHub Secrets (encrypted)

**To verify before pushing**:
```bash
git status  # Should NOT show channels.json
git diff --staged  # Review what will be committed
```

## Document Structure

The Google Doc is organized as:

```
# Lex Fridman Podcast

## #412 - Elon Musk (Nov 28, 2025) - 2h 15m
Summary: Discussion about AI, Twitter, and the future...
Key Topics: AI, Social Media, Space Exploration
Highlights:
- AI will transform society fundamentally
- Twitter's role in public discourse
Link: https://youtube.com/watch?v=abc123

---

# Huberman Lab

## Sleep Toolkit (Nov 27, 2025) - 1h 30m
...
```

## Configuration

### channels.json

- `id`: YouTube channel ID
- `name`: Display name for the channel
- `enabled`: `true` to process, `false` to skip

### Environment Variables

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (bypasses RLS) |
| `YOUTUBE_API_KEY` | YouTube Data API v3 key |
| `OPENAI_API_KEY` | OpenAI API key with GPT-5 access |
| `CHANNELS_JSON` | Inline JSON for your channels (preferred for CI) |
| `CHANNELS_JSON_BASE64` | Base64-encoded channels JSON (alternative to `CHANNELS_JSON`) |
| `OPENAI_MODEL` | Model to use for summaries (default: `gpt-5-mini`) |
| `OPENAI_MAX_OUTPUT_TOKENS` | Max tokens per response (default: `100000`) |
| `GOOGLE_DOCS_DOCUMENT_ID` | ID of your Google Doc |
| `GOOGLE_DOCS_CLIENT_EMAIL` | Service account email |
| `GOOGLE_DOCS_PRIVATE_KEY` | Service account private key |
| `DAYS_TO_LOOK_BACK` | Only process videos from last N days (default: 30) |
| `MAX_RESULTS_PER_CHANNEL` | Max videos to fetch per channel (default: 10) |

## Cost Estimate

**Monthly (10 channels, ~50 new videos/month):**
- GitHub Actions: **Free** (2,000 minutes/month free tier)
- YouTube API: **Free** (well under quota)
- Supabase: **Free** (using existing database)
- OpenAI GPT-5: **~$25-50/month** (depending on transcript length)
- Google Docs API: **Free** (unlimited)

**Total: ~$25-50/month** (OpenAI only)

## Troubleshooting

### "Missing required environment variable"
- Ensure all required environment variables are set in `.env`
- For GitHub Actions, check repository secrets

### "Failed to load channels configuration"
- Provide `CHANNELS_JSON` (or `CHANNELS_JSON_BASE64`) in `.env`/Secrets, or add a local `config/channels.json`
- Confirm the JSON is valid and includes a `channels` array

### "Failed to fetch transcript"
- Video may not have public captions
- Video might be age-restricted or private
- Worker will skip videos without transcripts

### "Failed to sync to Google Docs"
- Verify service account has Editor access to the document
- Check that Google Docs API is enabled
- Ensure `GOOGLE_DOCS_PRIVATE_KEY` includes `\n` characters

### GitHub Actions not running
- Check workflow file syntax
- Ensure Actions are enabled in repository settings
- Verify cron schedule is correct (UTC timezone)

## Development

```bash
# Install dependencies
npm install

# Run locally
npm run dev

# Build TypeScript
npm run build

# Run built version
npm start

# Lint code
npm run lint

# Format code
npm run format
```

## Project Structure

```
pod-worker/
├── .github/workflows/sync.yml    # GitHub Actions workflow
├── src/
│   ├── index.ts                  # Main entry point
│   ├── config.ts                 # Configuration loader
│   ├── supabase.ts               # Database client
│   ├── youtube.ts                # YouTube API wrapper
│   ├── openai.ts                 # AI summarization
│   ├── docs.ts                   # Google Docs integration
│   ├── processor.ts              # Core processing logic
│   └── logger.ts                 # Logging utility
├── types/database.ts             # TypeScript types
├── config/channels.json          # Channel configuration
├── .env.example                  # Environment template
├── package.json
└── tsconfig.json
```

## License

MIT

## Credits

Built using:
- [googleapis](https://github.com/googleapis/google-api-nodejs-client)
- [@danielxceron/youtube-transcript](https://github.com/danielxceron/youtube-transcript)
- [OpenAI API](https://platform.openai.com/)
- [Supabase](https://supabase.com/)
