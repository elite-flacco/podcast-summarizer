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
  watched?: boolean;
  favorite?: boolean;
}

export interface Channel {
  id: string;
  title: string;
}

export interface EpisodeFlag {
  video_id: string;
  watched: boolean;
  favorite: boolean;
}
