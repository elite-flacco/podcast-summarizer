import { google } from 'googleapis';
import { spawn } from 'child_process';
import { join } from 'path';
import { tmpdir } from 'os';

export interface YouTubeChannel {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  subscriberCount?: string;
}

export interface YouTubeVideo {
  id: string;
  channelId: string;
  channelTitle: string;
  title: string;
  description: string;
  publishedAt: string;
  thumbnailUrl: string;
  duration: string;
}

export interface YouTubeTranscriptSegment {
  text: string;
  start: number;
  duration: number;
}

export type TranscriptUnavailableReason =
  | 'disabled'
  | 'not_available'
  | 'language_unavailable'
  | 'video_unavailable'
  | 'request_blocked'
  | 'ip_blocked'
  | 'unknown';

export class TranscriptUnavailableError extends Error {
  constructor(
    message: string,
    public readonly reason: TranscriptUnavailableReason = 'unknown'
  ) {
    super(message);
    this.name = 'TranscriptUnavailableError';
  }
}

interface PythonRunner {
  command: string;
  args: string[];
}

interface PythonHelperSuccess<T> {
  ok: true;
  data: T;
}

interface PythonHelperFailure {
  ok: false;
  error_type?: string;
  message?: string;
  reason?: TranscriptUnavailableReason;
}

type PythonHelperResult<T> = PythonHelperSuccess<T> | PythonHelperFailure;

interface TranscriptFetchData {
  text: string;
}

interface AudioDownloadData {
  file_path: string;
}

let cachedPythonRunner: PythonRunner | null = null;

function getPythonScriptPath(): string {
  return join(__dirname, '..', 'scripts', 'youtube_helper.py');
}

async function resolvePythonRunner(): Promise<PythonRunner> {
  if (cachedPythonRunner) {
    return cachedPythonRunner;
  }

  const envPython = process.env.PYTHON_BIN?.trim();
  const candidates: PythonRunner[] = envPython
    ? [{ command: envPython, args: [] }]
    : process.platform === 'win32'
      ? [
          { command: 'python', args: [] },
          { command: 'py', args: ['-3'] },
        ]
      : [
          { command: 'python3', args: [] },
          { command: 'python', args: [] },
        ];

  for (const candidate of candidates) {
    const available = await new Promise<boolean>((resolve) => {
      const child = spawn(candidate.command, [...candidate.args, '--version']);

      child.once('error', (error: NodeJS.ErrnoException) => {
        resolve(error.code !== 'ENOENT' && error.code !== 'UNKNOWN');
      });

      child.once('exit', (code) => {
        resolve(code === 0);
      });
    });

    if (available) {
      cachedPythonRunner = candidate;
      return candidate;
    }
  }

  throw new Error(
    'Python 3 is required for transcript fetching. Set PYTHON_BIN if it is not on PATH.'
  );
}

async function runPythonHelper<T>(
  args: string[],
  operation: string,
  timeoutMs: number
): Promise<T> {
  const runner = await resolvePythonRunner();
  const scriptPath = getPythonScriptPath();

  return new Promise<T>((resolve, reject) => {
    const child = spawn(runner.command, [...runner.args, scriptPath, ...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    const timeoutId = setTimeout(() => {
      child.kill();
      reject(new Error(`${operation} timed out after ${timeoutMs / 1000}s`));
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.once('error', (error) => {
      clearTimeout(timeoutId);
      reject(
        new Error(
          `${operation} failed to start: ${error.message || 'unknown error'}`
        )
      );
    });

    child.once('close', (code) => {
      clearTimeout(timeoutId);

      const trimmedStdout = stdout.trim();
      const trimmedStderr = stderr.trim();
      const payload = trimmedStdout || trimmedStderr;

      if (!payload) {
        reject(
          new Error(
            `${operation} failed with exit code ${code ?? 'unknown'} and no output`
          )
        );
        return;
      }

      let parsed: PythonHelperResult<T>;
      try {
        parsed = JSON.parse(payload) as PythonHelperResult<T>;
      } catch {
        reject(
          new Error(
            `${operation} returned invalid output: ${payload.slice(0, 400)}`
          )
        );
        return;
      }

      if (parsed.ok) {
        resolve(parsed.data);
        return;
      }

      const message =
        parsed.message ||
        `${operation} failed with exit code ${code ?? 'unknown'}`;

      if (parsed.reason) {
        reject(new TranscriptUnavailableError(message, parsed.reason));
        return;
      }

      reject(new Error(message));
    });
  });
}

/**
 * Get videos from a specific channel
 */
export async function getChannelVideos(
  channelId: string,
  maxResults: number = 10
): Promise<YouTubeVideo[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error('Missing YOUTUBE_API_KEY environment variable');
  }

  const youtube = google.youtube({
    version: 'v3',
    auth: apiKey,
  });

  // First, get the uploads playlist ID
  const channelResponse = await youtube.channels.list({
    part: ['contentDetails'],
    id: [channelId],
  });

  const uploadsPlaylistId =
    channelResponse.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;

  if (!uploadsPlaylistId) {
    return [];
  }

  // Then get videos from the uploads playlist
  const playlistResponse = await youtube.playlistItems.list({
    part: ['snippet', 'contentDetails'],
    playlistId: uploadsPlaylistId,
    maxResults,
  });

  // Get video details including duration
  const videoIds = (playlistResponse.data.items || [])
    .map((item) => item.contentDetails?.videoId)
    .filter(Boolean) as string[];

  if (videoIds.length === 0) {
    return [];
  }

  const videosResponse = await youtube.videos.list({
    part: ['snippet', 'contentDetails'],
    id: videoIds,
  });

  return (videosResponse.data.items || [])
    .map((video) => ({
      id: video.id || '',
      channelId: video.snippet?.channelId || '',
      channelTitle: video.snippet?.channelTitle || '',
      title: video.snippet?.title || '',
      description: video.snippet?.description || '',
      publishedAt: video.snippet?.publishedAt || '',
      thumbnailUrl: video.snippet?.thumbnails?.medium?.url || '',
      duration: video.contentDetails?.duration || '',
    }))
    .filter((video) => {
      // Filter out YouTube Shorts (videos 3 minutes or less)
      const durationInSeconds = parseDuration(video.duration) * 60;
      return durationInSeconds > 180;
    });
}

/**
 * Fetch channel metadata for DB upserts
 */
export async function getChannelDetails(
  channelId: string
): Promise<YouTubeChannel | null> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error('Missing YOUTUBE_API_KEY environment variable');
  }

  const youtube = google.youtube({
    version: 'v3',
    auth: apiKey,
  });

  const response = await youtube.channels.list({
    part: ['snippet', 'statistics'],
    id: [channelId],
  });

  const channel = response.data.items?.[0];
  if (!channel) {
    return null;
  }

  return {
    id: channel.id || channelId,
    title: channel.snippet?.title || '',
    description: channel.snippet?.description || '',
    thumbnailUrl:
      channel.snippet?.thumbnails?.high?.url ||
      channel.snippet?.thumbnails?.medium?.url ||
      channel.snippet?.thumbnails?.default?.url ||
      '',
    subscriberCount: channel.statistics?.subscriberCount || undefined,
  };
}

/**
 * Get video captions/transcript using scraping method
 * Works for any video with publicly available captions (no auth required)
 */
export async function getVideoTranscript(videoId: string): Promise<string> {
  const transcriptData = await runPythonHelper<TranscriptFetchData>(
    ['transcript', videoId, '--language', 'en'],
    `transcript fetch for video ${videoId}`,
    60000
  );

  if (!transcriptData.text.trim()) {
    throw new TranscriptUnavailableError(
      'No captions are available for this video',
      'not_available'
    );
  }

  return transcriptData.text;
}

/**
 * Parse ISO 8601 duration to minutes
 */
export function parseDuration(duration: string): number {
  const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);

  if (!match) return 0;

  const hours = parseInt(match[1]) || 0;
  const minutes = parseInt(match[2]) || 0;
  const seconds = parseInt(match[3]) || 0;

  return hours * 60 + minutes + seconds / 60;
}

/**
 * Download YouTube video audio to a temporary file
 */
export async function downloadAudio(videoId: string): Promise<string> {
  const outputTemplate = join(
    tmpdir(),
    `yt-audio-${videoId}-${Date.now()}.%(ext)s`
  );

  const downloadData = await runPythonHelper<AudioDownloadData>(
    ['download-audio', videoId, '--output-template', outputTemplate],
    `audio download for video ${videoId}`,
    180000
  );

  return downloadData.file_path;
}
