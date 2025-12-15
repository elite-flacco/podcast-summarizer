import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get('videoId');

  if (!videoId) {
    return NextResponse.json({ error: 'Missing videoId' }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('episode_flags')
    .select('video_id, watched, favorite')
    .eq('video_id', videoId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ videoId, watched: false, favorite: false });
  }

  return NextResponse.json({
    videoId: data.video_id,
    watched: data.watched,
    favorite: data.favorite,
  });
}

export async function POST(request: Request) {
  const supabase = getSupabaseServerClient();

  try {
    const payload = await request.json();
    const videoId = payload?.videoId as string | undefined;
    const watched = payload?.watched as boolean | undefined;
    const favorite = payload?.favorite as boolean | undefined;

    if (!videoId) {
      return NextResponse.json({ error: 'Missing videoId' }, { status: 400 });
    }

    const update: Record<string, boolean | string> = { video_id: videoId };
    if (typeof watched === 'boolean') update.watched = watched;
    if (typeof favorite === 'boolean') update.favorite = favorite;

    if (!('watched' in update) && !('favorite' in update)) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    const { error } = await supabase.from('episode_flags').upsert(update, {
      onConflict: 'video_id',
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }
}
