import Link from 'next/link';
import Image from 'next/image';
import { Episode } from '@/lib/types';
import { formatDate, formatDuration } from '@/lib/format';
import { EpisodeActions } from './EpisodeActions';
import { Clock } from 'lucide-react';

interface Props {
  episode: Episode;
}

export function EpisodeCard({ episode }: Props) {
  return (
    <article className="episode-card">
      <Link href={`/episodes/${episode.id}`} className="episode-link">
        <div className="episode-thumb">
          <div className="case-spine" aria-hidden="true" />
          <div className="cd-face">
            {episode.thumbnailUrl ? (
              <Image
                src={episode.thumbnailUrl}
                alt={`${episode.title} thumbnail`}
                width={200}
                height={200}
                sizes="(min-width: 1024px) 200px, 60vw"
                priority={false}
                className="cd-art"
              />
            ) : null}
          </div>
        </div>

        <div className="episode-body">
          <h2 className="episode-title">{episode.title}</h2>
          <div>
            <div className="episode-channel">{episode.channelTitle}</div>
            <div className="episode-meta-line">

              <span>{formatDate(episode.publishedAt)}</span>
              <div className="episode-duration">
              <Clock size={12} strokeWidth={2} />
              <span >
                {formatDuration(episode.durationMinutes)}
              </span>
              </div>

            </div>
          </div>
        </div>
      </Link>
      {/* <EpisodeActions
        episodeId={episode.id}
        layout="compact"
        watched={episode.watched}
        favorite={episode.favorite}
      /> */}
    </article>
  );
}
