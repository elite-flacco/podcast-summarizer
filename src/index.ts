import 'dotenv/config';
import { loadConfig } from './config';
import { getSupabaseClient } from './supabase';
import { DocsWriter } from './docs';
import { PodcastProcessor } from './processor';
import { createLogger } from './logger';

/**
 * Main entry point for the podcast worker
 */
async function main() {
  const logger = createLogger();

  logger.info('========================================');
  logger.info('Pod Worker - YouTube Podcast Sync');
  logger.info('========================================');

  try {
    // Load configuration
    logger.info('Loading configuration...');
    const config = loadConfig();
    const enabledChannels = config.channels.filter((c) => c.enabled);
    logger.success(
      `Loaded config with ${enabledChannels.length} enabled channels`
    );

    // Initialize clients
    logger.info('Initializing clients...');
    const supabase = getSupabaseClient();
    const docs = new DocsWriter(
      config.googleDocs.documentId,
      config.googleDocs.credentials.clientEmail,
      config.googleDocs.credentials.privateKey,
      logger
    );
    logger.success('Clients initialized');

    // Run processor
    logger.info('Starting processing...');
    const processor = new PodcastProcessor(config, supabase, docs, logger);
    const results = await processor.run();

    // Log results
    logger.info('========================================');
    logger.info('Processing Complete');
    logger.info('========================================');
    logger.info(`Channels processed: ${results.channelsProcessed}`);
    logger.info(`Videos processed: ${results.videosProcessed}`);
    logger.info(`Summaries generated: ${results.summariesGenerated}`);

    if (results.errors.length > 0) {
      logger.warn(`Errors encountered: ${results.errors.length}`);
      results.errors.forEach((err, index) => {
        logger.error(
          `  ${index + 1}. ${err.channelId || err.videoId || 'Unknown'}: ${err.error}`
        );
      });

      // Exit with error code if there were any errors
      process.exit(1);
    } else {
      logger.success('All operations completed successfully!');
      process.exit(0);
    }
  } catch (error: any) {
    logger.error('========================================');
    logger.error('Fatal Error');
    logger.error('========================================');
    logger.error(error.message);
    if (error.stack) {
      logger.error(error.stack);
    }
    process.exit(1);
  }
}

// Run main function
main();
