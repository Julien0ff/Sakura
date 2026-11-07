'use client';

import { useSyncExternalStore, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ActionButton, Group, Row, Toggle } from '@/components/settings/grouped-list';
import { announceUpdate } from '@/components/desktop/desktop-bridge';
import { toast } from '@/components/ui/toast';
import { desktop, isDesktop } from '@/lib/desktop';

const noop = () => () => {};

/** Settings › Application: only inside the desktop app. */
export function AppGroup() {
  // false on the server and on the website; true once hydrated inside the app.
  const inApp = useSyncExternalStore(noop, isDesktop, () => false);
  const queryClient = useQueryClient();
  const [checking, setChecking] = useState(false);

  const { data: version } = useQuery({ queryKey: ['app-version'], enabled: inApp, queryFn: desktop.version, staleTime: Infinity });
  const { data: autostart = false } = useQuery({ queryKey: ['app-autostart'], enabled: inApp, queryFn: desktop.getAutostart });

  if (!inApp) return null;

  return (
    <Group title="Application" footer="Fermer la fenêtre garde SAKURA dans la barre des tâches. « Quitter » est dans le menu de son icône.">
      <Row label="Version" hint={version ? `SAKURA ${version}` : undefined}>
        <ActionButton
          disabled={checking}
          onClick={async () => {
            setChecking(true);
            const info = await desktop.checkUpdate();
            setChecking(false);
            if (info) announceUpdate(info);
            else toast('SAKURA est à jour');
          }}
        >
          {checking ? 'Recherche…' : 'Rechercher une mise à jour'}
        </ActionButton>
      </Row>
      <Toggle
        label="Lancer au démarrage"
        hint="Ouvre SAKURA en arrière-plan quand vous allumez l’ordinateur."
        checked={!!autostart}
        onChange={async (v) => {
          await desktop.setAutostart(v);
          void queryClient.invalidateQueries({ queryKey: ['app-autostart'] });
        }}
      />
    </Group>
  );
}
