import { getSupabaseServerClient } from './supabase';
import { Episode, Channel, EpisodeFlag } from './types';

interface VideoRow {
  id: string;
  channel_id: string;
  title: string;
  published_at: string;
  thumbnail_url: string | null;
  duration_minutes: number | null;
}

interface SummaryRow {
  video_id: string;
  summary: string;
  highlights: string[];
  key_topics: string[];
}

interface ChannelRow {
  id: string;
  title: string;
}

export async function getEpisodes(
  limit = 50,
  channelId?: string
): Promise<Episode[]> {
  const supabase = getSupabaseServerClient();

  let query = supabase
    .from('videos')
    .select(
      'id, channel_id, title, published_at, thumbnail_url, duration_minutes'
    )
    .order('published_at', { ascending: false })
    .limit(limit);

  if (channelId) {
    query = query.eq('channel_id', channelId);
  }

  const { data: videosData, error: videosError } = await query;

  if (videosError) {
    throw new Error(`Failed to load videos: ${videosError.message}`);
  }

  const videos = (videosData ?? []) as VideoRow[];

  if (videos.length === 0) {
    return [];
  }

  const videoIds = videos.map((video) => video.id);
  const channelIds = Array.from(
    new Set(videos.map((video) => video.channel_id))
  );

  const [
    { data: summaries, error: summariesError },
    { data: channels, error: channelsError },
    { data: flags, error: flagsError },
  ] = await Promise.all([
    supabase
      .from('summaries')
      .select('video_id, summary, highlights, key_topics')
      .in('video_id', videoIds),
    supabase.from('channels').select('id, title').in('id', channelIds),
    supabase
      .from('episode_flags')
      .select('video_id, watched, favorite')
      .in('video_id', videoIds),
  ]);

  if (summariesError) {
    throw new Error(`Failed to load summaries: ${summariesError.message}`);
  }

  if (channelsError) {
    throw new Error(`Failed to load channels: ${channelsError.message}`);
  }

  if (flagsError) {
    throw new Error(`Failed to load episode flags: ${flagsError.message}`);
  }

  const summaryMap = new Map<string, SummaryRow>();
  ((summaries ?? []) as SummaryRow[]).forEach((summary) =>
    summaryMap.set(summary.video_id, summary)
  );

  const channelMap = new Map<string, ChannelRow>();
  ((channels ?? []) as ChannelRow[]).forEach((channel) =>
    channelMap.set(channel.id, channel)
  );

  const flagMap = new Map<string, EpisodeFlag>();
  ((flags ?? []) as EpisodeFlag[]).forEach((flag) =>
    flagMap.set(flag.video_id, flag)
  );

  return videos.map((video) => {
    const summary = summaryMap.get(video.id);
    const channel = channelMap.get(video.channel_id);

    return {
      id: video.id,
      title: video.title,
      channelId: video.channel_id,
      channelTitle: channel?.title ?? 'Unknown channel',
      publishedAt: video.published_at,
      thumbnailUrl: video.thumbnail_url,
      durationMinutes: video.duration_minutes,
      summary: summary?.summary ?? null,
      highlights: summary?.highlights ?? [],
      keyTopics: summary?.key_topics ?? [],
      youtubeUrl: `https://www.youtube.com/watch?v=${video.id}`,
      watched: flagMap.get(video.id)?.watched ?? false,
      favorite: flagMap.get(video.id)?.favorite ?? false,
    };
  });
}

export async function getEpisodeById(id: string): Promise<Episode | null> {
  const supabase = getSupabaseServerClient();

  const { data: videoData, error: videoError } = await supabase
    .from('videos')
    .select(
      'id, channel_id, title, published_at, thumbnail_url, duration_minutes'
    )
    .eq('id', id)
    .single();

  if (videoError) {
    if (videoError.code === 'PGRST116' || videoError.code === 'PGRST106') {
      return null;
    }
    throw new Error(`Failed to load video: ${videoError.message}`);
  }

  const video = videoData as VideoRow;

  const [
    { data: summary, error: summaryError },
    { data: channel, error: channelError },
    { data: flag, error: flagError },
  ] = await Promise.all([
    supabase
      .from('summaries')
      .select('video_id, summary, highlights, key_topics')
      .eq('video_id', id)
      .maybeSingle(),
    supabase
      .from('channels')
      .select('id, title')
      .eq('id', video.channel_id)
      .maybeSingle(),
    supabase
      .from('episode_flags')
      .select('video_id, watched, favorite')
      .eq('video_id', id)
      .maybeSingle(),
  ]);

  if (summaryError) {
    throw new Error(`Failed to load summary: ${summaryError.message}`);
  }

  if (channelError) {
    throw new Error(`Failed to load channel: ${channelError.message}`);
  }

  if (flagError) {
    throw new Error(`Failed to load episode flags: ${flagError.message}`);
  }

  const typedSummary = summary as SummaryRow | null;
  const typedChannel = channel as ChannelRow | null;
  const typedFlag = flag as EpisodeFlag | null;

  return {
    id: video.id,
    title: video.title,
    channelId: video.channel_id,
    channelTitle: typedChannel?.title ?? 'Unknown channel',
    publishedAt: video.published_at,
    thumbnailUrl: video.thumbnail_url,
    durationMinutes: video.duration_minutes,
    summary: typedSummary?.summary ?? null,
    highlights: typedSummary?.highlights ?? [],
    keyTopics: typedSummary?.key_topics ?? [],
    youtubeUrl: `https://www.youtube.com/watch?v=${video.id}`,
    watched: typedFlag?.watched ?? false,
    favorite: typedFlag?.favorite ?? false,
  };
}

export async function getChannels(): Promise<Channel[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('channels')
    .select('id, title')
    .order('title');
  if (error) {
    throw new Error(`Failed to load channels: ${error.message}`);
  }
  return (
    (data as ChannelRow[] | null)?.map((channel) => ({
      id: channel.id,
      title: channel.title,
    })) ?? []
  );
}
