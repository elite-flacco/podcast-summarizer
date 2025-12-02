import { google, docs_v1 } from 'googleapis';
import { JWT } from 'google-auth-library';
import { Logger } from './logger';

export interface EpisodeData {
  videoId: string;
  title: string;
  publishedAt: string;
  duration: string;
  summary: string;
  keyTopics: string[];
  highlights: string[];
  videoUrl: string;
}

/**
 * Google Docs writer that syncs podcast episodes to a Google Doc
 */
export class DocsWriter {
  private docs: docs_v1.Docs;
  private documentId: string;
  private logger: Logger;

  constructor(
    documentId: string,
    clientEmail: string,
    privateKey: string,
    logger: Logger
  ) {
    const auth = new JWT({
      email: clientEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/documents'],
    });

    this.docs = google.docs({ version: 'v1', auth });
    this.documentId = documentId;
    this.logger = logger;
  }

  /**
   * Sync all channel episodes to the Google Doc
   * This replaces the entire document content
   */
  async syncDocument(
    channelEpisodes: Map<string, EpisodeData[]>
  ): Promise<void> {
    this.logger.info('Starting Google Docs sync...');

    // First, clear the document
    await this.clearDocument();

    // Build the document content
    const requests: docs_v1.Schema$Request[] = [];
    let currentIndex = 1; // Start after initial newline

    for (const [channelName, episodes] of channelEpisodes.entries()) {
      // Add channel heading (Heading 1)
      requests.push({
        insertText: {
          location: { index: currentIndex },
          text: `${channelName}\n`,
        },
      });

      requests.push({
        updateParagraphStyle: {
          range: {
            startIndex: currentIndex,
            endIndex: currentIndex + channelName.length + 1,
          },
          paragraphStyle: {
            namedStyleType: 'HEADING_1',
          },
          fields: 'namedStyleType',
        },
      });

      currentIndex += channelName.length + 1;

      // Add episodes for this channel
      for (const episode of episodes) {
        const episodeContent = this.formatEpisode(episode);
        const episodeLength = episodeContent.length;

        requests.push({
          insertText: {
            location: { index: currentIndex },
            text: episodeContent,
          },
        });

        // Format the episode title as Heading 2
        const titleEndIndex = currentIndex + episode.title.length + 1;
        requests.push({
          updateParagraphStyle: {
            range: {
              startIndex: currentIndex,
              endIndex: titleEndIndex,
            },
            paragraphStyle: {
              namedStyleType: 'HEADING_2',
            },
            fields: 'namedStyleType',
          },
        });

        // Make labels bold (Summary, Key Topics, Highlights, Link)
        const labels = ['Summary:', 'Key Topics:', 'Highlights:', 'Link:'];

        let searchIndex = currentIndex;
        for (const label of labels) {
          const labelStart = episodeContent.indexOf(
            label,
            searchIndex - currentIndex
          );
          if (labelStart !== -1) {
            const absoluteLabelStart = currentIndex + labelStart;
            const absoluteLabelEnd = absoluteLabelStart + label.length;

            requests.push({
              updateTextStyle: {
                range: {
                  startIndex: absoluteLabelStart,
                  endIndex: absoluteLabelEnd,
                },
                textStyle: {
                  bold: true,
                },
                fields: 'bold',
              },
            });

            searchIndex = absoluteLabelEnd;
          }
        }

        currentIndex += episodeLength;
      }

      // Add horizontal rule after channel (if not last channel)
      const isLastChannel =
        Array.from(channelEpisodes.keys()).pop() === channelName;
      if (!isLastChannel) {
        requests.push({
          insertText: {
            location: { index: currentIndex },
            text: '\n---\n\n',
          },
        });
        currentIndex += 6;
      }
    }

    // Apply all changes in a single batch
    if (requests.length > 0) {
      await this.docs.documents.batchUpdate({
        documentId: this.documentId,
        requestBody: {
          requests,
        },
      });

      this.logger.success(
        `Synced ${channelEpisodes.size} channels to Google Doc`
      );
    } else {
      this.logger.warn('No content to sync to Google Doc');
    }
  }

  /**
   * Format an episode as text
   */
  private formatEpisode(episode: EpisodeData): string {
    const publishDate = new Date(episode.publishedAt).toLocaleDateString(
      'en-US',
      {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }
    );

    const parts = [
      `${episode.title} (${publishDate}) - ${episode.duration}\n`,
      `Summary: ${episode.summary}\n`,
      `Key Topics: ${episode.keyTopics.join(', ')}\n`,
      `Highlights:\n${episode.highlights.map((h) => `- ${h}`).join('\n')}\n`,
      `Link: ${episode.videoUrl}\n\n`,
    ];

    return parts.join('');
  }

  /**
   * Clear all content in the document
   */
  private async clearDocument(): Promise<void> {
    // Get document to find end index
    const doc = await this.docs.documents.get({
      documentId: this.documentId,
    });

    const endIndex =
      doc.data.body?.content?.[doc.data.body.content.length - 1]?.endIndex;

    // endIndex points one past the last character. If it's 1 or 2, there's nothing to delete.
    if (!endIndex || endIndex <= 2) {
      this.logger.info('Document is already empty');
      return;
    }

    // Delete all content except the first character (required by Docs API)
    const startIndex = 1;
    const deleteEndIndex = endIndex - 1;
    if (deleteEndIndex <= startIndex) {
      this.logger.info('Document is already empty');
      return;
    }

    await this.docs.documents.batchUpdate({
      documentId: this.documentId,
      requestBody: {
        requests: [
          {
            deleteContentRange: {
              range: {
                startIndex,
                endIndex: deleteEndIndex,
              },
            },
          },
        ],
      },
    });

    this.logger.info('Cleared document content');
  }
}
