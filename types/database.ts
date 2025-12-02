// Database types matching Supabase schema

export interface User {
  id: string;
  email: string;
  name: string | null;
  google_access_token: string | null;
  google_refresh_token: string | null;
  created_at: string;
  updated_at: string;
}

export interface Channel {
  id: string; // YouTube channel ID
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  subscriber_count: string | null;
  channel_summary: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserChannel {
  id: string;
  user_id: string;
  channel_id: string;
  is_active: boolean;
  added_at: string;
}

export interface Video {
  id: string; // YouTube video ID
  channel_id: string;
  title: string;
  description: string | null;
  published_at: string;
  thumbnail_url: string | null;
  duration: string | null;
  duration_minutes: number | null;
  has_transcript: boolean;
  transcript_fetched_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Transcript {
  id: string;
  video_id: string;
  content: string;
  language: string;
  created_at: string;
}

export interface Summary {
  id: string;
  video_id: string;
  summary: string;
  key_topics: string[];
  highlights: string[];
  model: string;
  created_at: string;
  updated_at: string;
}

export interface UserVideoProgress {
  id: string;
  user_id: string;
  video_id: string;
  watched: boolean;
  watched_at: string | null;
  progress_seconds: number;
  created_at: string;
  updated_at: string;
}

// Combined types for views/queries

export interface PodcastEpisode extends Video {
  channel_title: string;
  channel_thumbnail: string | null;
  summary: string | null;
  key_topics: string[] | null;
  highlights: string[] | null;
  watched: boolean | null;
  watched_at: string | null;
  progress_seconds: number | null;
}

export interface ChannelWithVideos extends Channel {
  videos: Video[];
  unread_count: number;
}

// API Request/Response types

export interface AddChannelRequest {
  channelId: string;
  channelTitle: string;
  channelDescription?: string;
  thumbnailUrl?: string;
}

export interface FetchVideosRequest {
  channelId: string;
  maxResults?: number;
}

export interface SummarizeVideoRequest {
  videoId: string;
}

export interface UpdateProgressRequest {
  videoId: string;
  progressSeconds: number;
  watched: boolean;
}
