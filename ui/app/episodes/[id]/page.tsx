import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getEpisodeById } from '@/lib/data';
import { formatDate, formatDuration } from '@/lib/format';

interface Props {
  params: { id: string };
}

export default async function EpisodePage({ params }: Props) {
  const { id } = params;
  const episode = await getEpisodeById(id);

  if (!episode) {
    notFound();
  }

  return (
    <div className="episode-page">
      <div className="page-title">
        <h1>{episode.title}</h1>
      </div>

      <div className="episode-hero">
        <div className="episode-meta">
          <div className="pill">{episode.channelTitle}</div>
          <div className="pill">{formatDate(episode.publishedAt)}</div>
          <div className="pill">{formatDuration(episode.durationMinutes)}</div>
          <Link className="primary" href={episode.youtubeUrl} target="_blank" rel="noreferrer">
            Watch on YouTube
          </Link>
        </div>
      </div>

      <div className="summary-block">
        <h2>AI Summary</h2>
        <p className="summary-text">{episode.summary ?? 'No summary yet for this episode.'}</p>
      </div>

      {episode.highlights.length > 0 && (
        <div className="summary-block">
          <h3>Highlights</h3>
          <ul className="highlights">
            {episode.highlights.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {episode.keyTopics.length > 0 && (
        <div className="summary-block">
          <h3>Key Topics</h3>
          <div className="badges">
            {episode.keyTopics.map((topic) => (
              <span key={topic} className="badge">
                {topic}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="back-link">
        <Link href="/" className="ghost-button">
          {'<'}- Back to episodes
        </Link>
      </div>
    </div>
  );
}
