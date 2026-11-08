import type { Metadata } from 'next';
import { AppLayout } from '@/components/layout/app-layout';
import { latestRelease } from '@/lib/app-release-server';
import { AppDownload } from './app-download';

// Refreshed every 2 min even when GitHub didn't answer at build time (latestRelease has a deadline).
export const revalidate = 120;

export const metadata: Metadata = {
  title: 'Application SAKURA',
  description: 'Téléchargez l’application SAKURA pour Windows, Linux, Android et iPhone : statut Discord, notifications de sortie, mises à jour automatiques.',
};

export default async function AppPage() {
  const release = await latestRelease();
  return (
    <AppLayout>
      <AppDownload release={release} />
    </AppLayout>
  );
}
