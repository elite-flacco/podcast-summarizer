import { EpisodesBrowser } from '@/components/EpisodesBrowser';
import { getEpisodePage } from '@/lib/data';

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
    <EpisodesBrowser
      episodes={episodes}
      currentPage={currentPage}
      previousHref={previousHref}
      nextHref={nextHref}
      selectedChannel={selectedChannel}
      favoriteOnly={favoriteOnly}
      unwatchedOnly={unwatchedOnly}
    />
  );
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
