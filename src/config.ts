import { readFileSync } from 'fs';
import { join } from 'path';

export interface ChannelConfig {
  id: string; // YouTube channel ID
  name: string; // Display name
  enabled: boolean;
}

export interface ChannelsConfigFile {
  channels: ChannelConfig[];
}

export interface WorkerConfig {
  channels: ChannelConfig[];
  supabase: {
    url: string;
    serviceRoleKey: string;
  };
  youtube: {
    apiKey: string;
    maxResultsPerChannel: number;
  };
  openai: OpenAIConfig;
  googleDocs: {
    documentId: string;
    credentials: {
      clientEmail: string;
      privateKey: string;
    };
  };
  processing: {
    daysToLookBack: number;
  };
}

export interface OpenAIConfig {
  apiKey: string;
  model: string;
  maxOutputTokens: number;
}

/**
 * Load configuration from environment variables and channels.json
 */
export function loadConfig(): WorkerConfig {
  // Load channels from env first (to avoid committing secrets); fall back to file
  const configPath = join(process.cwd(), 'config', 'channels.json');
  const channelsJson =
    process.env.CHANNELS_JSON ||
    (process.env.CHANNELS_JSON_BASE64
      ? Buffer.from(process.env.CHANNELS_JSON_BASE64, 'base64').toString(
          'utf-8'
        )
      : undefined);

  let channelsConfig: ChannelsConfigFile;

  try {
    const raw =
      channelsJson !== undefined
        ? channelsJson
        : readFileSync(configPath, 'utf-8');
    channelsConfig = JSON.parse(raw);
  } catch {
    const source = channelsJson !== undefined ? 'environment' : configPath;
    throw new Error(
      `Failed to load channels configuration from ${source}. ` +
        'Provide CHANNELS_JSON/CHANNELS_JSON_BASE64 or add config/channels.json.'
    );
  }

  // Validate required environment variables
  const requiredEnvVars = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'YOUTUBE_API_KEY',
    'OPENAI_API_KEY',
    'GOOGLE_DOCS_DOCUMENT_ID',
    'GOOGLE_DOCS_CLIENT_EMAIL',
    'GOOGLE_DOCS_PRIVATE_KEY',
  ];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Missing required environment variable: ${envVar}`);
    }
  }

  const openaiModel = process.env.OPENAI_MODEL?.trim() || 'gpt-5-mini';
  const parsedOpenaiMaxTokens = parseInt(
    process.env.OPENAI_MAX_OUTPUT_TOKENS || '100000',
    10
  );
  const openaiMaxOutputTokens =
    Number.isNaN(parsedOpenaiMaxTokens) || parsedOpenaiMaxTokens <= 0
      ? 100000
      : parsedOpenaiMaxTokens;

  return {
    channels: channelsConfig.channels,
    supabase: {
      url: process.env.SUPABASE_URL!,
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
    },
    youtube: {
      apiKey: process.env.YOUTUBE_API_KEY!,
      maxResultsPerChannel: parseInt(
        process.env.MAX_RESULTS_PER_CHANNEL || '10',
        10
      ),
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY!,
      model: openaiModel,
      maxOutputTokens: openaiMaxOutputTokens,
    },
    googleDocs: {
      documentId: process.env.GOOGLE_DOCS_DOCUMENT_ID!,
      credentials: {
        clientEmail: process.env.GOOGLE_DOCS_CLIENT_EMAIL!,
        privateKey: process.env.GOOGLE_DOCS_PRIVATE_KEY!.replace(/\\n/g, '\n'),
      },
    },
    processing: {
      daysToLookBack: parseInt(process.env.DAYS_TO_LOOK_BACK || '30', 10),
    },
  };
}
