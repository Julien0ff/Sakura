import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AppLayout } from '@/components/layout/app-layout';
import { getPublicProfile } from '@/lib/supabase-server';
import { USERNAME_RE } from '@/lib/username';
import { siteConfig } from '@/lib/site-config';
import { ProfileView } from './profile-view';

type Props = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const profile = USERNAME_RE.test(username) ? await getPublicProfile(username) : null;
  if (!profile) return { title: 'Profil', robots: { index: false } };
  const name = profile.display_name || `@${profile.username}`;
  const stats = profile.blocks.find((b) => b.id === 'stats');
  const description =
    stats && 'stats' in stats
      ? `${stats.stats.completed} animes terminés · ${stats.stats.hours} h visionnées sur ${siteConfig.name}`
      : `Profil ${siteConfig.name} de @${profile.username}`;
  const image = profile.banner.url ?? `/banners/${(profile.banner.id ?? 'default:1').replace('default:', 'default-')}.svg`;
  return {
    title: `${name} (@${profile.username})`,
    description,
    openGraph: { title: `${name} (@${profile.username})`, description, images: [image], type: 'profile' },
    twitter: { card: 'summary_large_image', title: `${name} (@${profile.username})`, description, images: [image] },
  };
}

export default async function ProfilePage({ params }: Props) {
  const { username } = await params;
  // Malformed handles can't be usernames: real 404 without hitting the database.
  if (!USERNAME_RE.test(username)) notFound();
  const profile = await getPublicProfile(username);
  return (
    <AppLayout>
      <ProfileView username={username} initial={profile} />
    </AppLayout>
  );
}
