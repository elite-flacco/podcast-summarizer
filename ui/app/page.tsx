import { EpisodeCard } from '@/components/EpisodeCard';
import { FilterBar } from '@/components/FilterBar';
import { getEpisodes, getChannels } from '@/lib/data';
import { Episode } from '@/lib/types';

export const revalidate = 0; // always fetch latest flags and episodes

interface Props {
  searchParams?: { channel?: string; favorite?: string; watched?: string };
}

export default async function Page({ searchParams }: Props) {
  const selectedChannel = searchParams?.channel;
  const favoriteOnly = searchParams?.favorite === 'true';
  const watchedOnly = searchParams?.watched === 'true';
  const [episodes, channels] = await Promise.all([
    getEpisodes(50, selectedChannel),
    getChannels(),
  ]);

  let filtered = episodes;
  if (favoriteOnly) {
    filtered = filtered.filter((ep) => ep.favorite);
  }
  if (watchedOnly) {
    filtered = filtered.filter((ep) => ep.watched);
  }
  const grouped = groupEpisodes(filtered);

  return (
    <>
      <div className="page-title">
        <h1>Episodes</h1>
      </div>

      <FilterBar
        channels={channels}
        selectedChannel={selectedChannel}
        favoriteOnly={favoriteOnly}
        watchedOnly={watchedOnly}
      />

      {filtered.length === 0 && (
        <div className="empty">No episodes yet. Run the worker to fetch podcasts and summaries.</div>
      )}

      {grouped.thisWeek.length > 0 && (
        <section className="episode-section">
          <div className="section-heading">This Week</div>
          <div className="grid">
            {grouped.thisWeek.map((episode) => (
              <EpisodeCard key={episode.id} episode={episode} />
            ))}
          </div>
        </section>
      )}

      {grouped.lastWeek.length > 0 && (
        <section className="episode-section">
          <div className="section-heading">Last Week</div>
          <div className="grid">
            {grouped.lastWeek.map((episode) => (
              <EpisodeCard key={episode.id} episode={episode} />
            ))}
          </div>
        </section>
      )}

      {grouped.earlier.length > 0 && (
        <section className="episode-section">
          <div className="section-heading">Earlier</div>
          <div className="grid">
            {grouped.earlier.map((episode) => (
              <EpisodeCard key={episode.id} episode={episode} />
            ))}
          </div>
        </section>
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
