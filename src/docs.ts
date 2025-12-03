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
          text: `${channelName}\n\n`,
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

      currentIndex += channelName.length + 2;

      // Add episodes for this channel
      for (const episode of episodes) {
        const episodeStartIndex = currentIndex;
        const { content: episodeContent, highlightRanges } =
          this.formatEpisodeWithRanges(episode, currentIndex);
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

        // Make labels bold (Summary, Key Topics, Highlights)
        const labels = ['Summary:', 'Key Topics:', 'Highlights:'];

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

        // Convert highlights to bullet list
        for (const range of highlightRanges) {
          requests.push({
            createParagraphBullets: {
              range: {
                startIndex: range.start,
                endIndex: range.end,
              },
              bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE',
            },
          });
        }

        // Find and make the video link clickable
        const linkText = 'Watch on YouTube';
        const linkStart = episodeContent.indexOf(linkText);
        if (linkStart !== -1) {
          const absoluteLinkStart = currentIndex + linkStart;
          const absoluteLinkEnd = absoluteLinkStart + linkText.length;

          requests.push({
            updateTextStyle: {
              range: {
                startIndex: absoluteLinkStart,
                endIndex: absoluteLinkEnd,
              },
              textStyle: {
                link: {
                  url: episode.videoUrl,
                },
              },
              fields: 'link',
            },
          });
        }

        currentIndex += episodeLength;

        // Add spacing between episodes (but not after the last episode)
        const isLastEpisode = episodes[episodes.length - 1] === episode;
        if (!isLastEpisode) {
          requests.push({
            insertText: {
              location: { index: currentIndex },
              text: '\n',
            },
          });
          currentIndex += 1;
        }
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
   * Format ISO 8601 duration to human-readable format
   */
  private formatDuration(isoDuration: string): string {
    const match = isoDuration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);

    if (!match) return isoDuration; // Fallback to original if parse fails

    const hours = match[1] ? parseInt(match[1]) : 0;
    const minutes = match[2] ? parseInt(match[2]) : 0;

    const parts: string[] = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);

    return parts.join(' ') || '0m';
  }

  /**
   * Format an episode with tracked ranges for highlights
   */
  private formatEpisodeWithRanges(
    episode: EpisodeData,
    startIndex: number
  ): {
    content: string;
    highlightRanges: Array<{ start: number; end: number }>;
  } {
    const publishDate = new Date(episode.publishedAt).toLocaleDateString(
      'en-US',
      {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }
    );

    // Format the duration to be human-readable
    const formattedDuration = this.formatDuration(episode.duration);

    // Build content with better spacing
    const parts: string[] = [];
    let currentPos = startIndex;

    // Title line (will be Heading 2)
    const titleLine = `${episode.title}\n`;
    parts.push(titleLine);
    currentPos += titleLine.length;

    // Metadata line with extra spacing
    const metadataLine = `${publishDate} • ${formattedDuration}\n\n`;
    parts.push(metadataLine);
    currentPos += metadataLine.length;

    // Summary section
    const summaryLine = `Summary: ${episode.summary}\n\n`;
    parts.push(summaryLine);
    currentPos += summaryLine.length;

    // Key Topics section
    const topicsLine = `Key Topics: ${episode.keyTopics.join(', ')}\n\n`;
    parts.push(topicsLine);
    currentPos += topicsLine.length;

    // Highlights section
    const highlightsHeader = `Highlights:\n`;
    parts.push(highlightsHeader);
    currentPos += highlightsHeader.length;

    // Track each highlight range for bullet formatting
    const highlightRanges: Array<{ start: number; end: number }> = [];
    for (const highlight of episode.highlights) {
      const highlightLine = `${highlight}\n`;
      const highlightStart = currentPos;
      const highlightEnd = currentPos + highlightLine.length;

      highlightRanges.push({
        start: highlightStart,
        end: highlightEnd,
      });

      parts.push(highlightLine);
      currentPos += highlightLine.length;
    }

    // Add extra spacing after highlights
    parts.push('\n');
    currentPos += 1;

    // Video link (will be converted to hyperlink)
    const linkLine = `Watch on YouTube\n\n`;
    parts.push(linkLine);
    currentPos += linkLine.length;

    return {
      content: parts.join(''),
      highlightRanges,
    };
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
