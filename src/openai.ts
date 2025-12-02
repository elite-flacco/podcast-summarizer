import OpenAI from 'openai';
import type { OpenAIConfig } from './config';

let cachedClient: { apiKey: string; client: OpenAI } | null = null;

function getOpenAIClient(apiKey: string): OpenAI {
  if (!cachedClient || cachedClient.apiKey !== apiKey) {
    cachedClient = {
      apiKey,
      client: new OpenAI({ apiKey }),
    };
  }

  return cachedClient.client;
}

export interface PodcastSummary {
  title: string;
  summary: string;
  keyTopics: string[];
  highlights: string[];
  duration: string;
}

/**
 * Generate a summary of a podcast episode from its transcript
 */
export async function summarizePodcast(
  title: string,
  transcript: string,
  channelName: string,
  openaiConfig: OpenAIConfig
): Promise<PodcastSummary> {
  try {
    const openai = getOpenAIClient(openaiConfig.apiKey);

    const response = await openai.responses.create({
      model: openaiConfig.model,
      input: [
        {
          role: 'system',
          content: [
            {
              type: 'input_text',
              text: [
                'You are an expert at analyzing and summarizing podcast content.',
                'Return crisp, engaging summaries that stay true to the transcript.',
              ].join(' '),
            },
          ],
        },
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: [
                `Podcast title: "${title}" from channel "${channelName}".`,
                'Full transcript:',
                transcript,
                '',
                'Provide:',
                '1) A concise 2-3 sentence summary of the main topic.',
                '2) 3-5 key topics discussed.',
                '3) 3-5 notable highlights or insights.',
              ].join('\n'),
            },
          ],
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'podcast_summary',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              summary: {
                type: 'string',
                description: '2-3 sentence overview of the episode',
              },
              keyTopics: {
                type: 'array',
                description: '3-5 key topics discussed in the episode',
                minItems: 3,
                maxItems: 5,
                items: { type: 'string' },
              },
              highlights: {
                type: 'array',
                description: 'Notable highlights, insights, or takeaways',
                minItems: 3,
                maxItems: 5,
                items: { type: 'string' },
              },
              duration: {
                type: 'string',
                description:
                  'Optional human-friendly duration (e.g., "42m" or "1h 05m")',
              },
            },
            required: ['summary', 'keyTopics', 'highlights', 'duration'],
          },
        },
      },
      max_output_tokens: openaiConfig.maxOutputTokens,
    });

    const responseText = response.output_text;

    if (!responseText) {
      throw new Error('No response text from OpenAI');
    }

    const parsed = JSON.parse(responseText);

    return {
      title,
      summary: parsed.summary || '',
      keyTopics: parsed.keyTopics || [],
      highlights: parsed.highlights || [],
      duration: parsed.duration || '',
    };
  } catch (error) {
    console.error('Error generating summary:', error);
    throw new Error('Failed to generate podcast summary');
  }
}

/**
 * Generate a channel-level summary based on recent episodes
 */
export async function summarizeChannel(
  channelName: string,
  episodeSummaries: string[],
  openaiConfig: OpenAIConfig
): Promise<string> {
  const prompt = `You are analyzing recent podcast episodes from the channel "${channelName}".

Here are summaries of recent episodes:

${episodeSummaries.map((summary, i) => `Episode ${i + 1}: ${summary}`).join('\n\n')}

Provide a brief 2-3 sentence overview of what this podcast channel is about based on these recent episodes.`;

  try {
    const openai = getOpenAIClient(openaiConfig.apiKey);

    const response = await openai.responses.create({
      model: openaiConfig.model,
      input: [
        {
          role: 'system',
          content: [
            {
              type: 'input_text',
              text: 'You are an expert at analyzing podcast content and identifying themes.',
            },
          ],
        },
        {
          role: 'user',
          content: [{ type: 'input_text', text: prompt }],
        },
      ],
      max_output_tokens: Math.min(openaiConfig.maxOutputTokens, 200),
    });

    const responseText = response.output_text;

    if (!responseText) {
      throw new Error('No response text from OpenAI');
    }

    return responseText;
  } catch (error) {
    console.error('Error generating channel summary:', error);
    throw new Error('Failed to generate channel summary');
  }
}
