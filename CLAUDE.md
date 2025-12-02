# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Pod Worker is a standalone TypeScript worker that syncs YouTube podcast episodes to a Google Doc with AI-generated summaries. It runs as a scheduled GitHub Action that processes configured channels, fetches transcripts, generates summaries using GPT-5, and syncs everything to a single Google Doc.

## Development Commands

```bash
# Run locally (requires .env file)
npm run dev

# Build TypeScript to dist/
npm run build

# Run built version
npm start

# Lint code
npm run lint

# Format code
npm run format
```

## Architecture Overview

### Entry Point and Flow
The main entry point is `src/index.ts`, which orchestrates the entire sync process:
1. Loads configuration from `config/channels.json` and environment variables
2. Initializes Supabase client and Google Docs writer
3. Creates `PodcastProcessor` which runs the full pipeline
4. Exits with status code 0 (success) or 1 (errors)

### Core Processing Pipeline (src/processor.ts)
`PodcastProcessor.run()` executes these steps for each enabled channel:
1. Fetch latest videos from YouTube API (filtered by lookback period)
2. Check Supabase database for existing videos to avoid reprocessing
3. For each new video:
   - Upsert video metadata to `videos` table
   - Fetch transcript using `@danielxceron/youtube-transcript` (scraping method, no auth needed)
   - Store transcript in `transcripts` table
   - Generate AI summary using OpenAI GPT-5
   - Store summary in `summaries` table
4. After all channels are processed, sync all summaries to Google Docs

### Module Responsibilities

**src/config.ts**: Loads and validates configuration
- Reads `config/channels.json` for channel list (gitignored for privacy)
- Validates required environment variables
- Returns `WorkerConfig` with all settings

**src/youtube.ts**: YouTube API integration
- `getChannelVideos()`: Fetches videos from channel's uploads playlist
- Filters out YouTube Shorts (videos under 3 minutes)
- `getVideoTranscript()`: Scrapes video captions (no YouTube auth needed)
- `parseDuration()`: Converts ISO 8601 duration to minutes

**src/openai.ts**: AI summarization
- `summarizePodcast()`: Uses GPT-5 with structured JSON output
- Returns: 2-3 sentence summary, 3-5 key topics, 3-5 highlights
- `summarizeChannel()`: Generates channel-level overview (currently unused)

**src/docs.ts**: Google Docs integration
- `DocsWriter.syncDocument()`: Replaces entire document content
- Groups episodes by channel with Heading 1 for channels, Heading 2 for episodes
- Formats each episode: title, date, duration, summary, topics, highlights, link
- Uses JWT authentication with service account credentials

**src/supabase.ts**: Database client initialization
- Uses service role key to bypass RLS (Row Level Security)
- Worker operates at system level, not tied to specific user

**src/logger.ts**: Colored console logging utility

### Database Schema (types/database.ts)
The worker expects these Supabase tables:
- `videos`: Video metadata (id, channel_id, title, published_at, duration, has_transcript, etc.)
- `transcripts`: Full video transcripts (video_id, content, language)
- `summaries`: AI-generated summaries (video_id, summary, key_topics, highlights, model)
- `channels`: Channel metadata (not directly used by worker, but referenced)
- `user_channels`, `user_video_progress`: User-specific tables (not used by worker)

### Configuration Files

**config/channels.json** (gitignored):
```json
{
  "channels": [
    {
      "id": "UCBJycsmduvYEL83R_U4JriQ",
      "name": "Lex Fridman Podcast",
      "enabled": true
    }
  ]
}
```

**config/channels.example.json**: Template file committed to repo

### Environment Variables
Required (all validated at startup):
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `YOUTUBE_API_KEY` (YouTube Data API v3)
- `OPENAI_API_KEY` (requires GPT-5 access)
- `GOOGLE_DOCS_DOCUMENT_ID` (from doc URL)
- `GOOGLE_DOCS_CLIENT_EMAIL`, `GOOGLE_DOCS_PRIVATE_KEY` (service account)

Optional (with defaults):
- `DAYS_TO_LOOK_BACK` (default: 30)
- `MAX_RESULTS_PER_CHANNEL` (default: 10)

### GitHub Actions Workflow
`.github/workflows/sync.yml`:
- Runs daily at 6 AM UTC via cron schedule
- Can be manually triggered via `workflow_dispatch`
- Builds TypeScript, then runs `npm start`
- All credentials stored in GitHub Secrets
- Uploads logs on failure

## Important Patterns

### Error Handling
- Fatal configuration errors cause immediate exit with status 1
- Per-video errors are logged but don't stop channel processing
- Channel-level errors are collected in `results.errors[]`
- Final sync errors are added to results and cause exit 1

### Caching Strategy
Videos are upserted by ID. The worker:
- Checks existing video IDs before processing
- Only processes videos within `DAYS_TO_LOOK_BACK` window
- Stores `has_transcript` and `transcript_fetched_at` to track state
- Summary regeneration: Currently always regenerates if video is "new" (not in DB)

### Google Docs Syncing
The worker uses a "full replace" strategy:
1. Clears entire document (except required first character)
2. Rebuilds content from all summaries in database
3. Applies formatting in batch via `batchUpdate()` API
- This ensures doc stays in sync with database as source of truth
- All formatting (headings, bold labels, etc.) is applied via Docs API, not markdown

### Video Filtering
- Filters to videos published within `DAYS_TO_LOOK_BACK`
- Excludes YouTube Shorts (duration <= 3 minutes)
- Skips videos without available transcripts (logs warning, continues)

## Key Dependencies

- `googleapis`: YouTube Data API v3 and Google Docs API
- `@danielxceron/youtube-transcript`: Scrapes video captions without auth
- `openai`: GPT-5 API client (uses new Responses API format)
- `@supabase/supabase-js`: Database client for Postgres
- `google-auth-library`: JWT authentication for service accounts

## Privacy Model

This repo is designed to be forkable while keeping user data private:
- `channels.json` is gitignored (user's personal channel list)
- `channels.example.json` is committed (template for others)
- All credentials in GitHub Secrets or local `.env`
- Worker is single-user: each fork = one user's personal sync

## Known Constraints

- YouTube Shorts are filtered out (videos <= 3 minutes)
- Videos without public captions are skipped
- Worker uses service role key, so no per-user permissions
- Google Doc is fully replaced on each sync (no incremental updates)
- OpenAI GPT-5 is the only supported model for summaries
