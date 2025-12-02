import { google } from 'googleapis';
import { YoutubeTranscript } from '@danielxceron/youtube-transcript';

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
  try {
    // Fetch transcript using the scraping library
    const transcriptData = await YoutubeTranscript.fetchTranscript(videoId, {
      lang: 'en', // Prefer English
    });

    if (!transcriptData || transcriptData.length === 0) {
      throw new Error('No captions available for this video');
    }

    // Combine all transcript segments into single text
    const transcriptText = transcriptData.map((item) => item.text).join(' ');

    return transcriptText;
  } catch (error) {
    console.error('Error fetching transcript:', error);
    throw new Error(
      'Failed to fetch transcript for video. The video may not have captions available.'
    );
  }
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
