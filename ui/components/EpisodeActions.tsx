'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, Star } from 'lucide-react';

interface Props {
  episodeId: string;
  layout?: 'compact' | 'full';
  watched?: boolean;
  favorite?: boolean;
}

export function EpisodeActions({
  episodeId,
  layout = 'compact',
  watched: watchedInitial = false,
  favorite: favoriteInitial = false,
}: Props) {
  const router = useRouter();
  const [watched, setWatched] = useState<boolean>(watchedInitial);
  const [favorite, setFavorite] = useState<boolean>(favoriteInitial);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setWatched(Boolean(watchedInitial));
  }, [watchedInitial]);

  useEffect(() => {
    setFavorite(Boolean(favoriteInitial));
  }, [favoriteInitial]);

  const toggleWatched = () => {
    const next = !watched;
    setWatched(next);
    void persist({ watched: next });
  };

  const toggleFavorite = () => {
    const next = !favorite;
    setFavorite(next);
    void persist({ favorite: next });
  };

  async function persist(update: { watched?: boolean; favorite?: boolean }) {
    setSaving(true);
    try {
      const res = await fetch('/api/flags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId: episodeId, ...update }),
      });
      if (!res.ok) throw new Error('Failed to save');
      router.refresh();
    } catch {
      // rollback on failure
      if (typeof update.watched === 'boolean') setWatched((prev) => !prev);
      if (typeof update.favorite === 'boolean') setFavorite((prev) => !prev);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className={`episode-actions ${layout === 'compact' ? 'actions-compact' : ''}`}
    >
      <button
        type="button"
        className={`action-btn ${watched ? 'active' : ''}`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          toggleWatched();
        }}
        aria-pressed={watched}
        disabled={saving}
      >
        <CheckCircle size={16} />
      </button>
      <button
        type="button"
        className={`action-btn ${favorite ? 'active' : ''}`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          toggleFavorite();
        }}
        aria-pressed={favorite}
        disabled={saving}
      >
        <Star size={16} />
      </button>
    </div>
  );
}
