export interface Episode {
  id: string;
  title: string;
  channelId: string;
  channelTitle: string;
  publishedAt: string;
  thumbnailUrl: string | null;
  durationMinutes: number | null;
  summary: string | null;
  highlights: string[];
  keyTopics: string[];
  youtubeUrl: string;
}

export interface Channel {
  id: string;
  title: string;
}
