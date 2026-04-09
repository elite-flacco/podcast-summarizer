'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useSearch } from '@/components/SearchProvider';
import { Channel } from '@/lib/types';

interface Props {
  channels: Channel[];
  selectedChannel?: string;
  favoriteOnly?: boolean;
  unwatchedOnly?: boolean;
}

export function FilterBar({
  channels,
  selectedChannel,
  favoriteOnly,
  unwatchedOnly,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { query, setQuery } = useSearch();
  const selectedFromQuery = searchParams?.get('channel') ?? '';
  const favoriteFromQuery = searchParams?.get('favorite') === 'true';
  const unwatchedFromQuery = searchParams?.get('unwatched') === 'true';

  const resolvedChannel = selectedChannel ?? selectedFromQuery;
  const favoriteActive = favoriteOnly ?? favoriteFromQuery;
  const unwatchedActive = unwatchedOnly ?? unwatchedFromQuery;

  const pushParams = (params: URLSearchParams) => {
    const next = params.toString();
    router.replace(next ? `/?${next}` : '/');
  };

  const handleChange = (value: string) => {
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    params.delete('page');
    if (value) {
      params.set('channel', value);
    } else {
      params.delete('channel');
    }
    pushParams(params);
  };

  const handleFavoriteToggle = () => {
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    params.delete('page');
    if (favoriteActive) {
      params.delete('favorite');
    } else {
      params.set('favorite', 'true');
    }
    pushParams(params);
  };

  const handleUnwatchedToggle = () => {
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    params.delete('page');
    if (unwatchedActive) {
      params.delete('unwatched');
    } else {
      params.set('unwatched', 'true');
    }
    pushParams(params);
  };

  const handleClearSearch = () => {
    setQuery('');
  };

  return (
    <div className="filter-bar">
      <div className="filter-search">
        <input
          type="search"
          name="query"
          value={query}
          className="filter-input"
          placeholder="Search titles, notes, topics"
          aria-label="Search episodes"
          onChange={(e) => setQuery(e.target.value)}
        />
        {query ? (
          <button
            type="button"
            className="toggle-btn"
            onClick={handleClearSearch}
          >
            Clear
          </button>
        ) : null}
      </div>

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
        className={`toggle-btn ${unwatchedActive ? 'active' : ''}`}
        onClick={handleUnwatchedToggle}
        aria-pressed={unwatchedActive}
      >
        {unwatchedActive ? 'Show All' : 'Unwatched'}
      </button>
    </div>
  );
}
