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
                'Return crisp, engaging, and accurate summaries grounded strictly in the transcript.',
                'Identify not just what was discussed, but the most meaningful insights, arguments, or takeaways expressed by the speakers.',
                "For interview-style episodes, prioritize the guest's unique perspectives, claims, and actionable insights rather than generic topic descriptions.",
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
                '',
                'Full transcript:',
                transcript,
                '',
                'Provide the following:',
                '',
                '1) **Main Summary (2–3 sentences):**',
                '   A concise explanation of the core theme and what listeners will take away.',
                '',
                '2) **Key Topics (3–5 bullets):**',
                '   Clearly list the major subjects covered.',
                '',
                '3) **Notable Insights (5-10 bullets):**',
                '   Focus on the most interesting, surprising, or valuable insights.',
                '   • If it is an interview episode, emphasize the guest’s viewpoints, frameworks, lessons learned, or expertise.',
                '   • Avoid generic descriptions like “they talked about…”; highlight what the guest actually contributed intellectually.',
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
                minItems: 5,
                maxItems: 10,
                items: { type: 'string' },
              },
            },
            required: ['summary', 'keyTopics', 'highlights'],
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
