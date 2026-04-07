import Link from 'next/link';
import { EpisodeCard } from '@/components/EpisodeCard';
import { getEpisodePage } from '@/lib/data';
import { Episode } from '@/lib/types';

export const revalidate = 0; // always fetch latest flags and episodes
const PAGE_SIZE = 48;

interface Props {
  searchParams?: Promise<{
    channel?: string;
    favorite?: string;
    unwatched?: string;
    page?: string;
  }>;
}

export default async function Page({ searchParams }: Props) {
  const resolvedSearchParams = await searchParams;
  const selectedChannel = resolvedSearchParams?.channel;
  const favoriteOnly = resolvedSearchParams?.favorite === 'true';
  const unwatchedOnly = resolvedSearchParams?.unwatched === 'true';
  const currentPage = parsePage(resolvedSearchParams?.page);
  const offset = (currentPage - 1) * PAGE_SIZE;
  const { episodes, hasMore } = await getEpisodePage({
    limit: PAGE_SIZE,
    offset,
    channelId: selectedChannel,
    favoriteOnly,
    unwatchedOnly,
  });
  const grouped = groupEpisodes(episodes);
  const paginationBase = buildQueryString(resolvedSearchParams, {
    page: undefined,
  });
  const previousHref =
    currentPage > 1
      ? createPageHref(paginationBase, currentPage - 1)
      : undefined;
  const nextHref = hasMore
    ? createPageHref(paginationBase, currentPage + 1)
    : undefined;

  return (
    <>
      {episodes.length === 0 && (
        <div className="empty">
          No episodes match this page. Try a different filter or go back a page.
        </div>
      )}

      {grouped.thisWeek.length > 0 && (
        <section className="episode-section">
          <div className="section-heading">New Drops</div>
          <div className="grid">
            {grouped.thisWeek.map((episode) => (
              <EpisodeCard key={episode.id} episode={episode} />
            ))}
          </div>
        </section>
      )}

      {grouped.lastWeek.length > 0 && (
        <section className="episode-section">
          <div className="section-heading">From Last Week</div>
          <div className="grid">
            {grouped.lastWeek.map((episode) => (
              <EpisodeCard key={episode.id} episode={episode} />
            ))}
          </div>
        </section>
      )}

      {grouped.earlier.length > 0 && (
        <section className="episode-section">
          <div className="section-heading">Back Catalog</div>
          <div className="grid">
            {grouped.earlier.map((episode) => (
              <EpisodeCard key={episode.id} episode={episode} />
            ))}
          </div>
        </section>
      )}

      {(previousHref || nextHref) && (
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
      )}
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
  const day = copy.getDay(); // 0 (Sun) ... 6 (Sat)
  const diff = (day + 6) % 7; // convert to Monday-based
  copy.setHours(0, 0, 0, 0);
  copy.setDate(copy.getDate() - diff);
  return copy;
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function parsePage(page?: string) {
  const parsed = Number.parseInt(page ?? '1', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function createPageHref(baseQuery: string, page: number) {
  if (!baseQuery) {
    return page === 1 ? '/' : `/?page=${page}`;
  }

  return page === 1 ? `/?${baseQuery}` : `/?${baseQuery}&page=${page}`;
}

function buildQueryString(
  searchParams: Awaited<Props['searchParams']>,
  overrides: Record<string, string | undefined>
) {
  const params = new URLSearchParams();

  Object.entries(searchParams ?? {}).forEach(([key, value]) => {
    if (typeof value === 'string' && value.length > 0) {
      params.set(key, value);
    }
  });

  Object.entries(overrides).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
  });

  return params.toString();
}
