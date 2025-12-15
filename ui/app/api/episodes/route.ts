import { NextResponse } from 'next/server';
import { getEpisodes } from '@/lib/data';

export async function GET() {
  try {
    const episodes = await getEpisodes();
    return NextResponse.json({ episodes });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to load episodes';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
