'use client';

import { useSyncExternalStore, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ActionButton, Group, Row, Segmented, Toggle } from '@/components/settings/grouped-list';
import type { NotifyLang } from '@/lib/notify-targets';
import { announceAndroidUpdate, announceUpdate } from '@/components/desktop/desktop-bridge';
import { toast } from '@/components/ui/toast';
import { currentApp, desktop, isApp, isDesktop, type DiscordLinkStatus, type PresenceStatus } from '@/lib/desktop';
import { ADD_SOURCE_LINKS } from '@/lib/app-release';
import { checkAndroidUpdate } from '@/lib/mobile-update';
import { useAppStore } from '@/core/store';

const noop = () => () => {};

const LINK_LABELS: Record<DiscordLinkStatus['state'], string> = {
  unavailable: 'Indisponible dans cette version',
  not_linked: 'Reliez votre compte pour afficher « Regarde <anime> » sur votre profil, comme sur PC.',
  linking: 'Autorisez SAKURA dans Discord…',
  connecting: 'Connexion à Discord…',
  connected: 'Relié : votre statut s’affiche quand l’app est ouverte.',
  error: 'Erreur de connexion à Discord',
};

const PRESENCE_LABELS: Record<PresenceStatus, string> = {
  idle: 'en attente d’une lecture',
  connected: 'connecté à Discord',
  discord_not_found: 'Discord introuvable (ouvert ?)',
  rejected: 'refusé par Discord',
};

/** Settings › Application: only inside the SAKURA apps (PC: every row; phones: version + releases). */
export function AppGroup() {
  // false on the server and on the website; true once hydrated inside an app.
  const inApp = useSyncExternalStore(noop, isApp, () => false);
  const pc = useSyncExternalStore(noop, isDesktop, () => false);
  const kind = useSyncExternalStore(noop, currentApp, () => null);
  const queryClient = useQueryClient();
  const [checking, setChecking] = useState(false);
  const discordPresence = useAppStore((s) => s.settings.discordPresence ?? true);
  const discordBrowsing = useAppStore((s) => s.settings.discordBrowsing ?? true);
  const releaseNotifications = useAppStore((s) => s.settings.releaseNotifications ?? true);
  const notifyLang = useAppStore((s) => s.settings.notifyLang ?? 'auto');
  const updateSettings = useAppStore((s) => s.updateSettings);

  const { data: version } = useQuery({
    queryKey: ['app-version'],
    enabled: inApp,
    queryFn: desktop.version,
    staleTime: Infinity,
  });
  const { data: presence } = useQuery({
    queryKey: ['app-presence-status'],
    enabled: pc && discordPresence,
    queryFn: desktop.presenceStatus,
    refetchInterval: 5000,
  });
  const mobile = kind === 'android' || kind === 'ios';
  const { data: link, refetch: refetchLink } = useQuery({
    queryKey: ['app-discord-link'],
    enabled: mobile,
    queryFn: desktop.discordStatus,
    // Faster while Discord's screen is open / the link is being set up.
    refetchInterval: (q) => (q.state.data && ['linking', 'connecting'].includes(q.state.data.state) ? 1500 : 10_000),
  });
  const { data: autostart = false } = useQuery({
    queryKey: ['app-autostart'],
    enabled: pc,
    queryFn: desktop.getAutostart,
  });

  if (!inApp) return null;

  return (
    <Group
      title="Application"
      footer={
        pc
          ? 'Fermer la fenêtre garde SAKURA dans la barre des tâches. « Quitter » est dans le menu de son icône.'
          : 'Les sorties des 7 prochains jours sont programmées à chaque ouverture de SAKURA : ouvrez l’app au moins une fois par semaine.'
      }
    >
      <Row label="Version" hint={version ? `SAKURA ${version}` : undefined}>
        {pc && (
          <ActionButton
            disabled={checking}
            onClick={async () => {
              setChecking(true);
              try {
                const info = await desktop.checkUpdate();
                if (info) announceUpdate(info);
                else toast('SAKURA est à jour');
              } catch {
                toast('Impossible de vérifier les mises à jour pour le moment');
              } finally {
                setChecking(false);
              }
            }}
          >
            {checking ? 'Recherche…' : 'Rechercher une mise à jour'}
          </ActionButton>
        )}
        {kind === 'android' && (
          <ActionButton
            disabled={checking}
            onClick={async () => {
              setChecking(true);
              try {
                const u = await checkAndroidUpdate();
                if (u) announceAndroidUpdate(u);
                else toast('SAKURA est à jour');
              } catch {
                toast('Impossible de vérifier les mises à jour pour le moment');
              } finally {
                setChecking(false);
              }
            }}
          >
            {checking ? 'Recherche…' : 'Rechercher une mise à jour'}
          </ActionButton>
        )}
      </Row>
      {kind === 'ios' && (
        <Row label="Mises à jour" hint="Ajoutez la source SAKURA à SideStore ou AltStore : chaque nouvelle version y sera proposée." stackOnMobile>
          <div className="flex gap-2">
            {(['sidestore', 'altstore'] as const).map((store) => (
              <ActionButton key={store} onClick={() => void desktop.openExternal(ADD_SOURCE_LINKS[store]).catch(() => toast(`${store === 'sidestore' ? 'SideStore' : 'AltStore'} n’est pas installé`))}>
                {store === 'sidestore' ? 'SideStore' : 'AltStore'}
              </ActionButton>
            ))}
          </div>
        </Row>
      )}
      <Toggle
        label="Notifications de sortie"
        hint={
          pc
            ? 'Un nouvel épisode d’un anime « En cours » ou « À voir » de votre liste, même fenêtre fermée.'
            : 'Un nouvel épisode d’un anime « En cours » ou « À voir » de votre liste, même app fermée.'
        }
        checked={releaseNotifications}
        onChange={(v) => updateSettings({ releaseNotifications: v })}
      />
      {releaseNotifications && (
        <Row label="Langue des sorties" hint="Auto : votre langue par défaut." stackOnMobile>
          <Segmented<NotifyLang>
            label="Langue des sorties"
            value={notifyLang}
            options={[
              ['auto', 'Auto'],
              ['vostfr', 'VOSTFR'],
              ['vf', 'VF'],
              ['all', 'Les deux'],
            ]}
            onChange={(v) => updateSettings({ notifyLang: v })}
          />
        </Row>
      )}
      {mobile && link && link.state !== 'unavailable' && (
        <Row label="Compte Discord" hint={LINK_LABELS[link.state] + (link.error ? ` (${link.error})` : '')} stackOnMobile>
          {link.state === 'not_linked' || link.state === 'error' ? (
            <ActionButton
              onClick={async () => {
                try {
                  await desktop.discordLink();
                } catch (e) {
                  toast(`Liaison impossible : ${String(e)}`);
                }
                void refetchLink();
              }}
            >
              Relier Discord
            </ActionButton>
          ) : (
            <ActionButton
              onClick={async () => {
                await desktop.discordUnlink();
                void refetchLink();
              }}
            >
              Délier
            </ActionButton>
          )}
        </Row>
      )}
      {(pc || (link && link.state !== 'unavailable')) && (
        <>
          <Toggle
            label="Statut Discord"
            hint={`Affiche « Regarde <anime> · Épisode » sur votre profil Discord pendant la lecture.${pc && discordPresence && presence ? ` État : ${PRESENCE_LABELS[presence]}.` : ''}`}
            checked={discordPresence}
            onChange={(v) => updateSettings({ discordPresence: v })}
          />
          {discordPresence && (
            <Toggle
              label="Afficher la navigation"
              hint="Hors lecture : la page en cours (« Parcourt le catalogue », « Consulte la fiche »…)."
              checked={discordBrowsing}
              onChange={(v) => updateSettings({ discordBrowsing: v })}
            />
          )}
        </>
      )}
      {pc && (
        <>
          <Toggle
            label="Lancer au démarrage"
            hint="Ouvre SAKURA en arrière-plan quand vous allumez l’ordinateur."
            checked={!!autostart}
            onChange={async (v) => {
              await desktop.setAutostart(v);
              void queryClient.invalidateQueries({
                queryKey: ['app-autostart'],
              });
            }}
          />
        </>
      )}
    </Group>
  );
}
