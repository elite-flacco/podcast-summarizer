import Link from 'next/link';
import Image from 'next/image';
import { Episode } from '@/lib/types';
import { formatDate, formatDuration } from '@/lib/format';
import { EpisodeActions } from './EpisodeActions';

interface Props {
  episode: Episode;
}

export function EpisodeCard({ episode }: Props) {
  return (
    <article className="episode-card">
      <Link href={`/episodes/${episode.id}`} className="episode-link">
        <div className="episode-thumb">
          {episode.thumbnailUrl ? (
            <Image
              src={episode.thumbnailUrl}
              alt={`${episode.title} thumbnail`}
              fill
              sizes="(min-width: 1024px) 300px, 50vw"
              priority={false}
            />
          ) : null}
          <div className="episode-badges">
            <span className="badge">{formatDuration(episode.durationMinutes)}</span>
            <span className="badge">{formatDate(episode.publishedAt)}</span>
          </div>
        </div>
        <div className="episode-body">
          <h2 className="episode-title">{episode.title}</h2>
          <div className="episode-channel">{episode.channelTitle}</div>
          <div className="episode-meta-line">
            <span>{formatDate(episode.publishedAt)}</span>
            <span>·</span>
            <span>{formatDuration(episode.durationMinutes)}</span>
          </div>
        </div>
      </Link>
      <EpisodeActions episodeId={episode.id} layout="compact" />
    </article>
  );
}
