// Database types matching the minimal worker schema
// Only includes tables the worker reads/writes.

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
