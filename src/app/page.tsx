import { AppLayout } from '@/components/layout/app-layout';
import { HeroBanner } from '@/components/home/hero-banner';
import { HorizontalRow } from '@/components/home/horizontal-row';
import { ContinueWatchingRow } from '@/components/home/continue-watching-row';
import { getCurrentSeason } from '@/core/api/anilist';

export default function Home() {
  const { season, year } = getCurrentSeason();

  return (
    <AppLayout>
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
        <HeroBanner />

        <ContinueWatchingRow />
        <HorizontalRow title="Tendances Actuelles" variables={{ sort: ['TRENDING_DESC'] }} />
        <HorizontalRow title="Saison Actuelle" variables={{ sort: ['POPULARITY_DESC'], season, seasonYear: year }} />
        <HorizontalRow title="Les plus populaires" variables={{ sort: ['POPULARITY_DESC'] }} />
        <HorizontalRow title="Les mieux notés" variables={{ sort: ['SCORE_DESC'] }} />
      </div>
    </AppLayout>
  );
}
