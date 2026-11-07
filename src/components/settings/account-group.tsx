'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Group, Row, ActionButton } from '@/components/settings/grouped-list';
import { Avatar } from '@/components/account/avatar';
import { DiscordIcon, GoogleIcon } from '@/components/account/provider-icons';
import { linkProvider, signIn, signOut, useAuth, type Provider } from '@/core/auth';
import { accountsEnabled, supabase } from '@/lib/supabase';
import { prepareAvatar } from '@/lib/avatar';
import { haptic } from '@/lib/haptics';

const PROVIDERS: { id: Provider; label: string; Icon: typeof DiscordIcon }[] = [
  { id: 'discord', label: 'Discord', Icon: DiscordIcon },
  { id: 'google', label: 'Google', Icon: GoogleIcon },
];

/** Supabase error codes → French. */
function authErrorMessage(e: unknown): string {
  const code = (e as { code?: string })?.code;
  switch (code) {
    case 'manual_linking_disabled':
      return 'La liaison de comptes n’est pas encore activée sur le serveur.';
    case 'identity_already_exists':
      return 'Ce compte est déjà lié à un autre profil SAKURA.';
    case 'single_identity_not_deletable':
      return 'Impossible de délier votre seule méthode de connexion.';
    case 'provider_disabled':
      return 'Ce mode de connexion n’est pas disponible pour le moment.';
    default:
      return (e as Error)?.message || 'Une erreur est survenue.';
  }
}

/** Providers enabled on the Supabase project (public endpoint), so disabled ones show as unavailable. */
function useEnabledProviders() {
  const [enabled, setEnabled] = useState<Record<string, boolean> | null>(null);
  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) return;
    fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } })
      .then((r) => r.json())
      .then((s) => setEnabled(s.external ?? {}))
      .catch(() => setEnabled(null));
  }, []);
  return enabled;
}

export function AccountGroup() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const enabled = useEnabledProviders();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: identities = [], refetch: loadIdentities } = useQuery({
    queryKey: ['identities', user?.id],
    enabled: !!user && !!supabase,
    queryFn: async () => (await supabase!.auth.getUserIdentities()).data?.identities ?? [],
  });

  const run = async (key: string, fn: () => Promise<void>) => {
    setError(null);
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      haptic('warning');
      setError(authErrorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  if (!accountsEnabled) return null;
  if (loading) return <Group title="Compte"><div className="h-[56px]" /></Group>;

  // ───────── Signed out ─────────
  if (!user) {
    return (
      <Group title="Compte" footer="Connectez-vous pour retrouver votre liste, votre historique et votre progression sur tous vos appareils. Sans compte, tout reste sur cet appareil.">
        {PROVIDERS.map(({ id, label, Icon }) => {
          const off = enabled !== null && !enabled[id];
          return (
            <button
              key={id}
              type="button"
              disabled={off || busy !== null}
              onClick={() => run(id, () => signIn(id, '/settings'))}
              className="w-full flex items-center gap-3 px-4 min-h-[56px] text-left text-[16px] text-white active:bg-white/[0.03] disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            >
              <Icon className={`w-5 h-5 ${id === 'discord' ? 'text-[#5865F2]' : ''}`} />
              <span className="flex-1">Continuer avec {label}</span>
              {off && <span className="text-[13px] text-[#8E8E93]">Bientôt</span>}
              {busy === id && <span className="text-[13px] text-[#8E8E93]">…</span>}
            </button>
          );
        })}
        {error && <p role="alert" className="px-4 py-3 text-[13px] text-[#FF6961]">{error}</p>}
      </Group>
    );
  }

  // ───────── Signed in ─────────
  const avatarUrl = profile?.avatar_url ?? (user.user_metadata?.avatar_url as string | undefined);
  const displayName = profile?.display_name ?? (user.user_metadata?.full_name as string | undefined) ?? '';

  const changeAvatar = (file: File) =>
    run('avatar', async () => {
      const client = supabase!;
      const blob = await prepareAvatar(file);
      const path = `${user.id}/avatar-${Date.now()}.webp`;
      const { error: upErr } = await client.storage.from('avatars').upload(path, blob, { contentType: 'image/webp', upsert: false });
      if (upErr) throw upErr;
      const { data } = client.storage.from('avatars').getPublicUrl(path);
      const previous = profile?.avatar_url;
      const { error: dbErr } = await client.from('profiles').update({ avatar_url: data.publicUrl }).eq('id', user.id);
      if (dbErr) throw dbErr;
      // Remove the previous upload (provider avatars live elsewhere and are left alone).
      const marker = '/storage/v1/object/public/avatars/';
      if (previous?.includes(marker)) {
        const old = decodeURIComponent(previous.split(marker)[1]);
        if (old.startsWith(`${user.id}/`)) await client.storage.from('avatars').remove([old]);
      }
      haptic('success');
      await refreshProfile();
    });

  const deleteAccount = () =>
    run('delete', async () => {
      if (!confirm('Supprimer définitivement votre compte et toutes ses données synchronisées ?')) return;
      const client = supabase!;
      const { data: files } = await client.storage.from('avatars').list(user.id);
      if (files?.length) await client.storage.from('avatars').remove(files.map((f) => `${user.id}/${f.name}`));
      const { error: rpcErr } = await client.rpc('delete_own_account');
      if (rpcErr) throw rpcErr;
      haptic('warning');
      await signOut();
    });

  return (
    <>
      <Group title="Compte">
        <div className="flex items-center gap-4 px-4 py-4">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy !== null}
            aria-label="Changer de photo de profil"
            className="relative rounded-full cursor-pointer group"
          >
            <Avatar src={avatarUrl} alt={displayName} size={64} />
            <span className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 flex items-center justify-center text-[11px] font-semibold text-white transition-opacity">
              {busy === 'avatar' ? '…' : 'Modifier'}
            </span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) void changeAvatar(f);
            }}
          />
          <div className="min-w-0">
            <div className="text-[17px] font-semibold text-white truncate">{displayName || 'Sans nom'}</div>
            {profile?.username ? (
              <div className="text-[15px] text-[#8E8E93] truncate">@{profile.username}</div>
            ) : (
              <Link href="/onboarding?next=/settings" className="text-[15px] text-sakura">Choisir un pseudo</Link>
            )}
          </div>
        </div>
        <Row label="Photo de profil" hint="Carrée de préférence ; recadrée automatiquement.">
          <ActionButton onClick={() => fileRef.current?.click()} disabled={busy !== null}>
            {busy === 'avatar' ? 'Envoi…' : 'Changer'}
          </ActionButton>
        </Row>
        {error && <p role="alert" className="px-4 py-3 text-[13px] text-[#FF6961]">{error}</p>}
      </Group>

      <Group title="Comptes liés" footer="Connectez-vous avec l’un ou l’autre : c’est le même compte SAKURA.">
        {PROVIDERS.map(({ id, label, Icon }) => {
          const identity = identities.find((i) => i.provider === id);
          const off = enabled !== null && !enabled[id];
          const handle = (identity?.identity_data?.full_name ?? identity?.identity_data?.email ?? '') as string;
          return (
            <Row key={id} label={label} hint={identity ? handle || 'Lié' : off ? 'Indisponible pour le moment' : 'Non lié'}>
              <div className="flex items-center gap-3">
                <Icon className={`w-5 h-5 ${id === 'discord' ? 'text-[#5865F2]' : ''}`} />
                {identity ? (
                  <ActionButton
                    destructive
                    disabled={identities.length < 2 || busy !== null}
                    onClick={() =>
                      run(`unlink-${id}`, async () => {
                        const { error: e } = await supabase!.auth.unlinkIdentity(identity);
                        if (e) throw e;
                        haptic('light');
                        await loadIdentities();
                      })
                    }
                  >
                    Délier
                  </ActionButton>
                ) : (
                  <ActionButton
                    disabled={off || busy !== null}
                    onClick={() =>
                      run(`link-${id}`, async () => {
                        await linkProvider(id);
                      })
                    }
                  >
                    Lier
                  </ActionButton>
                )}
              </div>
            </Row>
          );
        })}
      </Group>

      <Group title="Session">
        <Row label="Se déconnecter" hint="Vos données synchronisées sont retirées de cet appareil.">
          <ActionButton disabled={busy !== null} onClick={() => run('signout', signOut)}>
            Déconnexion
          </ActionButton>
        </Row>
        <Row label="Supprimer mon compte" hint="Définitif : profil, liste, historique et progression synchronisés.">
          <ActionButton destructive disabled={busy !== null} onClick={deleteAccount}>
            Supprimer
          </ActionButton>
        </Row>
      </Group>
    </>
  );
}
