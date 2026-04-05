import EpisodePage from '../app/(app)/episodes/[id]/page';
import HomePage from '../app/(app)/page';

type AsyncRoutePage<TProps> = (props: TProps) => Promise<unknown>;

const episodePageContract: AsyncRoutePage<{
  params: Promise<{ id: string }>;
}> = EpisodePage;

const homePageContract: AsyncRoutePage<{
  searchParams?: Promise<{
    channel?: string;
    favorite?: string;
    watched?: string;
  }>;
}> = HomePage;

void episodePageContract;
void homePageContract;
