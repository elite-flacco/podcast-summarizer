import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from './logger';
import { DocsWriter, EpisodeData } from './docs';
import { WorkerConfig, ChannelConfig } from './config';
import {
  getChannelDetails,
  getChannelVideos,
  getVideoTranscript,
  parseDuration,
} from './youtube';
import { summarizePodcast } from './openai';

export interface ProcessingResult {
  channelsProcessed: number;
  videosProcessed: number;
  summariesGenerated: number;
  errors: Array<{ channelId?: string; videoId?: string; error: string }>;
}

/**
 * Main processor that handles video fetching, summarization, and syncing
 */
export class PodcastProcessor {
  private readonly SUMMARY_TIMEOUT_MS = 180000;
  private readonly TRANSCRIPT_TIMEOUT_MS = 60000;

  constructor(
    private config: WorkerConfig,
    private supabase: SupabaseClient,
    private docs: DocsWriter,
    private logger: Logger
  ) {}

  /**
   * Run the full processing pipeline
   */
  async run(): Promise<ProcessingResult> {
    const results: ProcessingResult = {
      channelsProcessed: 0,
      videosProcessed: 0,
      summariesGenerated: 0,
      errors: [],
    };

    this.logger.info(
      `Starting processor for ${this.config.channels.filter((c) => c.enabled).length} enabled channels...`
    );

    // Process each enabled channel
    for (const channel of this.config.channels) {
      if (!channel.enabled) {
        this.logger.info(`Skipping disabled channel: ${channel.name}`);
        continue;
      }

      try {
        this.logger.info(`Processing channel: ${channel.name}`);
        await this.ensureChannelExists(channel);
        const channelResults = await this.processChannel(channel);
        results.videosProcessed += channelResults.videosProcessed;
        results.summariesGenerated += channelResults.summariesGenerated;
        results.channelsProcessed++;
      } catch (error: any) {
        this.logger.error(
          `Failed to process channel ${channel.name}:`,
          error.message
        );
        results.errors.push({
          channelId: channel.id,
          error: error.message,
        });
      }
    }

    // Sync all data to Google Docs
    try {
      await this.syncToGoogleDocs();
    } catch (error: any) {
      this.logger.error('Failed to sync to Google Docs:', error.message);
      results.errors.push({ error: error.message });
    }

    return results;
  }

  /**
   * Process a single channel
   */
  private async processChannel(
    channel: ChannelConfig
  ): Promise<{ videosProcessed: number; summariesGenerated: number }> {
    let videosProcessed = 0;
    let summariesGenerated = 0;

    // Fetch latest videos from YouTube
    const videos = await getChannelVideos(
      channel.id,
      this.config.youtube.maxResultsPerChannel
    );

    this.logger.info(`Found ${videos.length} videos for ${channel.name}`);

    // Filter to recent videos (within lookback period)
    const cutoffDate = new Date();
    cutoffDate.setDate(
      cutoffDate.getDate() - this.config.processing.daysToLookBack
    );

    const recentVideos = videos.filter(
      (v) => new Date(v.publishedAt) > cutoffDate
    );

    this.logger.info(
      `${recentVideos.length} videos within last ${this.config.processing.daysToLookBack} days`
    );

    // Check which videos already exist in database
    const existingVideoIds = await this.getExistingVideoIds(
      recentVideos.map((v) => v.id)
    );

    const newVideos = recentVideos.filter(
      (v) => !existingVideoIds.includes(v.id)
    );

    if (newVideos.length === 0) {
      this.logger.info(`No new videos to process for ${channel.name}`);
      return { videosProcessed, summariesGenerated };
    }

    this.logger.info(
      `Processing ${newVideos.length} new videos for ${channel.name}`
    );

    // Process each new video
    for (const video of newVideos) {
      try {
        await this.processVideo(video, channel);
        videosProcessed++;
        summariesGenerated++;
        this.logger.success(`✓ Processed: ${video.title}`);
      } catch (error: any) {
        this.logger.error(`✗ Failed to process ${video.title}:`, error.message);
        // Continue with next video instead of throwing
      }
    }

    return { videosProcessed, summariesGenerated };
  }

  /**
   * Ensure the channel exists in the DB before inserting videos
   */
  private async ensureChannelExists(channel: ChannelConfig): Promise<void> {
    const { data: existingChannel, error: fetchError } = await this.supabase
      .from('channels')
      .select('id')
      .eq('id', channel.id)
      .maybeSingle();

    if (fetchError) {
      this.logger.warn(
        `Could not verify channel ${channel.name} in database: ${fetchError.message}. Will attempt upsert.`
      );
    }

    if (existingChannel) {
      return;
    }

    const metadata = await getChannelDetails(channel.id);

    const { error: upsertError } = await this.supabase.from('channels').upsert({
      id: channel.id,
      title: metadata?.title || channel.name,
      description: metadata?.description || null,
      thumbnail_url: metadata?.thumbnailUrl || null,
      subscriber_count: metadata?.subscriberCount || null,
      channel_summary: null,
    });

    if (upsertError) {
      throw new Error(
        `Failed to upsert channel ${channel.name}: ${upsertError.message}`
      );
    }

    this.logger.info(
      `Ensured channel ${metadata?.title || channel.name} exists in database`
    );
  }

  /**
   * Process a single video: upsert metadata, fetch transcript, generate summary
   */
  private async processVideo(
    video: any,
    channel: ChannelConfig
  ): Promise<void> {
    this.logger.info(`Upserting metadata for ${video.title}...`);

    // 1. Upsert video to database
    const { error: videoError } = await this.supabase.from('videos').upsert({
      id: video.id,
      channel_id: channel.id,
      title: video.title,
      description: video.description,
      published_at: video.publishedAt,
      thumbnail_url: video.thumbnailUrl,
      duration: video.duration,
      duration_minutes: Math.round(parseDuration(video.duration)),
      has_transcript: false,
      transcript_fetched_at: null,
    });

    if (videoError) {
      throw new Error(`Failed to upsert video: ${videoError.message}`);
    }

    // 2. Get or fetch transcript
    let transcript: string;

    // Check if transcript already exists in database
    const { data: existingTranscript } = await this.supabase
      .from('transcripts')
      .select('content')
      .eq('video_id', video.id)
      .maybeSingle();

    if (existingTranscript?.content) {
      this.logger.info(`Using existing transcript for ${video.title}`);
      transcript = existingTranscript.content;
    } else {
      // Fetch new transcript from YouTube
      try {
        this.logger.info(`Fetching transcript for ${video.title}...`);
        transcript = await this.withTimeout(
          getVideoTranscript(video.id),
          this.TRANSCRIPT_TIMEOUT_MS,
          `transcript fetch for ${video.title}`
        );

        // Store transcript
        const { error: transcriptError } = await this.supabase
          .from('transcripts')
          .upsert(
            {
              video_id: video.id,
              content: transcript,
              language: 'en',
            },
            { onConflict: 'video_id' }
          );

        if (transcriptError) {
          throw new Error(
            `Failed to store transcript: ${transcriptError.message}`
          );
        }

        // Update video to mark transcript as fetched
        await this.supabase
          .from('videos')
          .update({
            has_transcript: true,
            transcript_fetched_at: new Date().toISOString(),
          })
          .eq('id', video.id);
      } catch (error: any) {
        // Skip videos without transcripts
        this.logger.warn(
          `Skipping summary for ${video.title} due to transcript error: ${error.message}`
        );
        throw new Error(`No transcript available: ${error.message}`);
      }
    }

    // 3. Generate AI summary
    this.logger.info(`Generating summary for ${video.title}...`);
    const summary = await this.withTimeout(
      summarizePodcast(
        video.title,
        transcript,
        channel.name,
        this.config.openai
      ),
      this.SUMMARY_TIMEOUT_MS,
      `OpenAI summary for ${video.title}`
    );
    this.logger.info(`Summary generated for ${video.title}`);

    // 4. Store summary
    const { error: summaryError } = await this.supabase
      .from('summaries')
      .upsert(
        {
          video_id: video.id,
          summary: summary.summary,
          key_topics: summary.keyTopics,
          highlights: summary.highlights,
          model: this.config.openai.model,
        },
        { onConflict: 'video_id' }
      );

    if (summaryError) {
      throw new Error(`Failed to store summary: ${summaryError.message}`);
    }
  }

  /**
   * Get list of video IDs that have been fully processed (have transcript and summary)
   */
  private async getExistingVideoIds(videoIds: string[]): Promise<string[]> {
    if (videoIds.length === 0) return [];

    const { data, error } = await this.supabase
      .from('videos')
      .select('id, has_transcript, summaries(video_id)')
      .in('id', videoIds);

    if (error) {
      this.logger.error('Failed to check existing videos:', error.message);
      return [];
    }

    // Only return videos that have both transcript and summary
    return (data || [])
      .filter((v: any) => v.has_transcript && v.summaries)
      .map((v) => v.id);
  }

  /**
   * Sync all summaries to Google Docs
   */
  private async syncToGoogleDocs(): Promise<void> {
    this.logger.info('Fetching summaries from database...');

    const enabledChannelIds = this.config.channels
      .filter((c) => c.enabled)
      .map((c) => c.id);

    if (enabledChannelIds.length === 0) {
      this.logger.warn('No enabled channels to sync');
      return;
    }

    // Fetch all videos with summaries for enabled channels
    const { data, error } = await this.supabase
      .from('videos')
      .select(
        `
        id,
        channel_id,
        title,
        published_at,
        duration,
        summaries (
          summary,
          key_topics,
          highlights
        )
      `
      )
      .in('channel_id', enabledChannelIds)
      .not('summaries', 'is', null)
      .order('published_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch summaries: ${error.message}`);
    }

    if (!data || data.length === 0) {
      this.logger.warn('No summaries found to sync');
      return;
    }

    // Group episodes by channel
    const channelEpisodesMap = new Map<string, EpisodeData[]>();

    for (const video of data as any[]) {
      if (!video.summaries) continue;

      const channelConfig = this.config.channels.find(
        (c) => c.id === video.channel_id
      );
      const channelName = channelConfig?.name || video.channel_id;

      if (!channelEpisodesMap.has(channelName)) {
        channelEpisodesMap.set(channelName, []);
      }

      channelEpisodesMap.get(channelName)!.push({
        videoId: video.id,
        title: video.title,
        publishedAt: video.published_at,
        duration: video.duration || 'Unknown',
        summary: video.summaries.summary || '',
        keyTopics: video.summaries.key_topics || [],
        highlights: video.summaries.highlights || [],
        videoUrl: `https://youtube.com/watch?v=${video.id}`,
      });
    }

    this.logger.info(
      `Syncing ${data.length} episodes across ${channelEpisodesMap.size} channels to Google Docs...`
    );

    // Sync to Google Docs
    await this.docs.syncDocument(channelEpisodesMap);
  }

  private async withTimeout<T>(
    promise: Promise<T>,
    ms: number,
    operation: string
  ): Promise<T> {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`${operation} timed out after ${ms / 1000}s`));
      }, ms);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }
}
