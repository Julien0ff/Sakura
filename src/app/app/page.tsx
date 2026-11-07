import type { Metadata } from 'next';
import { AppLayout } from '@/components/layout/app-layout';
import { readRelease, type GhRelease } from '@/lib/app-release';
import { AppDownload } from './app-download';

export const metadata: Metadata = {
  title: 'Application SAKURA',
  description: 'Téléchargez l’application SAKURA pour Windows et Linux : statut Discord, notifications de sortie, mises à jour automatiques.',
};

const RELEASES_API = 'https://api.github.com/repos/Julien0ff/Sakura/releases?per_page=10';

async function latestRelease() {
  try {
    // Cached 15 min: GitHub allows 60 anonymous requests per hour from the server's IP.
    const res = await fetch(RELEASES_API, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'SAKURA' },
      next: { revalidate: 900 },
    });
    if (!res.ok) return null;
    return readRelease((await res.json()) as GhRelease[]);
  } catch {
    return null;
  }
}

export default async function AppPage() {
  const release = await latestRelease();
  return (
    <AppLayout>
      <AppDownload release={release} />
    </AppLayout>
  );
}
