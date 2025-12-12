'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Channel } from '@/lib/types';

interface Props {
  channels: Channel[];
  selectedChannel?: string;
  favoriteOnly?: boolean;
  watchedOnly?: boolean;
}

export function FilterBar({ channels, selectedChannel, favoriteOnly = false, watchedOnly = false }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleChange = (value: string) => {
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    if (value) {
      params.set('channel', value);
    } else {
      params.delete('channel');
    }
    router.push(`/?${params.toString()}`);
  };

  const handleFavoriteToggle = () => {
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    if (favoriteOnly) {
      params.delete('favorite');
    } else {
      params.set('favorite', 'true');
    }
    router.push(`/?${params.toString()}`);
  };

  const handleWatchedToggle = () => {
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    if (watchedOnly) {
      params.delete('watched');
    } else {
      params.set('watched', 'true');
    }
    router.push(`/?${params.toString()}`);
  };

  return (
    <div className="filter-bar">
      <label className="filter-label" htmlFor="channel">
        Filter by artist
      </label>
      <select
        id="channel"
        name="channel"
        className="filter-select"
        value={selectedChannel ?? ''}
        onChange={(e) => handleChange(e.target.value)}
        >
          <option value="">All</option>
          {channels.map((channel) => (
            <option key={channel.id} value={channel.id}>
              {channel.title}
            </option>
          ))}
        </select>

      <button
        type="button"
        className={`toggle-btn ${favoriteOnly ? 'active' : ''}`}
        onClick={handleFavoriteToggle}
        aria-pressed={favoriteOnly}
      >
        {favoriteOnly ? 'Show All' : 'Favorites'}
      </button>

      <button
        type="button"
        className={`toggle-btn ${watchedOnly ? 'active' : ''}`}
        onClick={handleWatchedToggle}
        aria-pressed={watchedOnly}
      >
        {watchedOnly ? 'Show All' : 'Played ✓'}
      </button>
    </div>
  );
}
