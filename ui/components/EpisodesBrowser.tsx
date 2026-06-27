'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { EpisodeCard } from '@/components/EpisodeCard';
import { useSearch } from '@/components/SearchProvider';
import { Episode } from '@/lib/types';

interface Props {
  episodes: Episode[];
  currentPage?: number;
  previousHref?: string;
  nextHref?: string;
  selectedChannel?: string;
  favoriteOnly?: boolean;
  unwatchedOnly?: boolean;
}

export function EpisodesBrowser({
  episodes,
  currentPage,
  previousHref,
  nextHref,
  selectedChannel,
  favoriteOnly = false,
  unwatchedOnly = false,
}: Props) {
  const { query } = useSearch();
  const trimmedQuery = query.trim();
  const normalizedQuery = trimmedQuery.toLowerCase();
  const searchKey = [
    normalizedQuery,
    selectedChannel ?? '',
    favoriteOnly ? 'favorite' : '',
    unwatchedOnly ? 'unwatched' : '',
  ].join('|');
  const [searchState, setSearchState] = useState<{
    key: string;
    episodes: Episode[];
    isSearching: boolean;
  } | null>(null);

  useEffect(() => {
    if (!normalizedQuery) {
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setSearchState({ key: searchKey, episodes: [], isSearching: true });

      try {
        const params = new URLSearchParams({ query: trimmedQuery });

        if (selectedChannel) {
          params.set('channel', selectedChannel);
        }
        if (favoriteOnly) {
          params.set('favorite', 'true');
        }
        if (unwatchedOnly) {
          params.set('unwatched', 'true');
        }

        const response = await fetch(`/api/episodes?${params.toString()}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error('Failed to search episodes');
        }

        const data = (await response.json()) as { episodes: Episode[] };
        setSearchState({
          key: searchKey,
          episodes: data.episodes,
          isSearching: false,
        });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        console.error(error);
        setSearchState({ key: searchKey, episodes: [], isSearching: false });
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [
    favoriteOnly,
    normalizedQuery,
    searchKey,
    selectedChannel,
    trimmedQuery,
    unwatchedOnly,
  ]);

  const activeSearchState = searchState?.key === searchKey ? searchState : null;
  const isSearching = Boolean(
    normalizedQuery && (!activeSearchState || activeSearchState.isSearching),
  );

  const filtered = useMemo(() => {
    if (normalizedQuery) {
      return activeSearchState?.episodes ?? [];
    }

    return episodes;
  }, [activeSearchState?.episodes, episodes, normalizedQuery]);

  const grouped = groupEpisodes(filtered);

  return (
    <>
      {isSearching ? (
        <div className="empty">Searching your collection…</div>
      ) : null}

      {!isSearching && filtered.length === 0 && (
        <div className="empty">
          {trimmedQuery
            ? `No records matched "${trimmedQuery}". Try a different title, topic, or channel.`
            : 'Your rack is empty. Run the worker to start building your collection.'}
        </div>
      )}

      {!isSearching && grouped.thisWeek.length > 0 && (
        <section className="episode-section">
          <div className="section-heading">New Drops</div>
          <div className="grid">
            {grouped.thisWeek.map((episode) => (
              <EpisodeCard key={episode.id} episode={episode} />
            ))}
          </div>
        </section>
      )}

      {!isSearching && grouped.lastWeek.length > 0 && (
        <section className="episode-section">
          <div className="section-heading">From Last Week</div>
          <div className="grid">
            {grouped.lastWeek.map((episode) => (
              <EpisodeCard key={episode.id} episode={episode} />
            ))}
          </div>
        </section>
      )}

      {!isSearching && grouped.earlier.length > 0 && (
        <section className="episode-section">
          <div className="section-heading">Back Catalog</div>
          <div className="grid">
            {grouped.earlier.map((episode) => (
              <EpisodeCard key={episode.id} episode={episode} />
            ))}
          </div>
        </section>
      )}

      {!normalizedQuery && (previousHref || nextHref) && currentPage ? (
        <nav className="pagination" aria-label="Episode pages">
          {previousHref ? (
            <Link href={previousHref} className="pagination-link">
              Newer
            </Link>
          ) : (
            <span className="pagination-link pagination-link-disabled">
              Newer
            </span>
          )}

          <span className="pagination-status">Page {currentPage}</span>

          {nextHref ? (
            <Link href={nextHref} className="pagination-link">
              Older
            </Link>
          ) : (
            <span className="pagination-link pagination-link-disabled">
              Older
            </span>
          )}
        </nav>
      ) : null}
    </>
  );
}

function groupEpisodes(episodes: Episode[]) {
  const now = new Date();
  const startOfThisWeek = startOfWeek(now);
  const startOfLastWeek = addDays(startOfThisWeek, -7);

  const buckets = {
    thisWeek: [] as Episode[],
    lastWeek: [] as Episode[],
    earlier: [] as Episode[],
  };

  episodes.forEach((episode) => {
    const published = new Date(episode.publishedAt);
    if (published >= startOfThisWeek) {
      buckets.thisWeek.push(episode);
    } else if (published >= startOfLastWeek) {
      buckets.lastWeek.push(episode);
    } else {
      buckets.earlier.push(episode);
    }
  });

  return buckets;
}

function startOfWeek(date: Date) {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = (day + 6) % 7;
  copy.setHours(0, 0, 0, 0);
  copy.setDate(copy.getDate() - diff);
  return copy;
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}
