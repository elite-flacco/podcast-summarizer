import { NextRequest, NextResponse } from 'next/server';
import { getEpisodes, searchEpisodes } from '@/lib/data';

export async function GET(request: NextRequest) {
  try {
    const channelId = request.nextUrl.searchParams.get('channel') ?? undefined;
    const favoriteOnly =
      request.nextUrl.searchParams.get('favorite') === 'true';
    const unwatchedOnly =
      request.nextUrl.searchParams.get('unwatched') === 'true';
    const query = request.nextUrl.searchParams.get('query')?.trim() ?? '';
    const episodes = query
      ? await searchEpisodes({
          channelId,
          favoriteOnly,
          unwatchedOnly,
          query,
        })
      : await getEpisodes({ limit: 200, channelId });

    return NextResponse.json({ episodes });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to load episodes';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
