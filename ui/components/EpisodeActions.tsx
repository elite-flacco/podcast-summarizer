'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, Star } from 'lucide-react';

interface Props {
  episodeId: string;
  layout?: 'compact' | 'full';
}

export function EpisodeActions({ episodeId, layout = 'compact' }: Props) {
  const [watched, setWatched] = useState(false);
  const [favorite, setFavorite] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchFlags = async () => {
      try {
        const res = await fetch(`/api/flags?videoId=${episodeId}`);
        if (!res.ok) throw new Error('Failed to load flags');
        const data = await res.json();
        if (!isMounted) return;
        setWatched(Boolean(data.watched));
        setFavorite(Boolean(data.favorite));
      } catch {
        // ignore and fall back to defaults
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchFlags();
    return () => {
      isMounted = false;
    };
  }, [episodeId]);

  const disabled = loading;

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
    try {
      const res = await fetch('/api/flags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId: episodeId, ...update }),
      });
      if (!res.ok) throw new Error('Failed to save');
    } catch {
      // rollback on failure
      if (typeof update.watched === 'boolean') setWatched((prev) => !prev);
      if (typeof update.favorite === 'boolean') setFavorite((prev) => !prev);
    }
  }

  return (
    <div className={`episode-actions ${layout === 'compact' ? 'actions-compact' : ''}`}>
      <button
        type="button"
        className={`action-btn ${watched ? 'active' : ''}`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          toggleWatched();
        }}
        aria-pressed={watched}
        disabled={disabled}
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
        disabled={disabled}
      >
        <Star size={16} />
      </button>
    </div>
  );
}
