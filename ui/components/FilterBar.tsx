'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Channel } from '@/lib/types';

interface Props {
  channels: Channel[];
  selectedChannel?: string;
  favoriteOnly?: boolean;
  watchedOnly?: boolean;
}

export function FilterBar({
  channels,
  selectedChannel,
  favoriteOnly,
  watchedOnly,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedFromQuery = searchParams?.get('channel') ?? '';
  const favoriteFromQuery = searchParams?.get('favorite') === 'true';
  const watchedFromQuery = searchParams?.get('watched') === 'true';

  const resolvedChannel = selectedChannel ?? selectedFromQuery;
  const favoriteActive = favoriteOnly ?? favoriteFromQuery;
  const watchedActive = watchedOnly ?? watchedFromQuery;

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
    if (favoriteActive) {
      params.delete('favorite');
    } else {
      params.set('favorite', 'true');
    }
    router.push(`/?${params.toString()}`);
  };

  const handleWatchedToggle = () => {
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    if (watchedActive) {
      params.delete('watched');
    } else {
      params.set('watched', 'true');
    }
    router.push(`/?${params.toString()}`);
  };

  return (
    <div className="filter-bar">
      <select
        id="channel"
        name="channel"
        className="filter-select"
        value={resolvedChannel}
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
        className={`toggle-btn ${favoriteActive ? 'active' : ''}`}
        onClick={handleFavoriteToggle}
        aria-pressed={favoriteActive}
      >
        {favoriteActive ? 'Show All' : 'Favorites'}
      </button>

      <button
        type="button"
        className={`toggle-btn ${watchedActive ? 'active' : ''}`}
        onClick={handleWatchedToggle}
        aria-pressed={watchedActive}
      >
        {watchedActive ? 'Show All' : 'Played'}
      </button>
    </div>
  );
}
