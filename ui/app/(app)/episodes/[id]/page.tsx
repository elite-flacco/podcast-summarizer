import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { getEpisodeById } from '@/lib/data';
import { formatDate, formatDuration } from '@/lib/format';
import { EpisodeActions } from '@/components/EpisodeActions';

// Force dynamic rendering to always fetch fresh data from Supabase
export const dynamic = 'force-dynamic';

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
          <Link
            className="primary"
            href={episode.youtubeUrl}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink
              size={14}
              style={{ marginRight: 6, verticalAlign: 'middle' }}
            />
            Play on YouTube
          </Link>
        </div>
        <EpisodeActions
          episodeId={episode.id}
          layout="full"
          watched={episode.watched}
          favorite={episode.favorite}
        />
      </div>

      <div className="summary-block">
        <h2>Liner Notes</h2>
        <p className="summary-text">
          {episode.summary ?? 'No liner notes yet for this record.'}
        </p>
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
          <ArrowLeft
            size={14}
            style={{ marginRight: 6, verticalAlign: 'middle' }}
          />
          Back to the collection
        </Link>
      </div>
    </div>
  );
}
