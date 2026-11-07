'use client';

import { AppLayout } from '@/components/layout/app-layout';
import { useAuth } from '@/core/auth';
import { useAppStore, type EpisodeView, type Lang } from '@/core/store';
import { Settings } from '@/components/ui/icons';
import { haptic, testHaptic, setHapticIntensity, type HapticIntensity } from '@/lib/haptics';
import { useState, useSyncExternalStore } from 'react';
import { Group, Row, Segmented, ActionButton, Toggle } from '@/components/settings/grouped-list';
import { openChangelog } from '@/components/layout/changelog-popup';
import { AccountGroup } from '@/components/settings/account-group';

export default function SettingsPage() {
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const clearHistory = useAppStore((s) => s.clearHistory);
  const { user } = useAuth();
  const touchDevice = useTouchDevice();

  return (
    <AppLayout>
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 px-4 sm:px-6 md:pl-32 md:pr-10 pt-[max(env(safe-area-inset-top),24px)] md:pt-10 pb-10">
        {/* pr-14 on phones keeps the title clear of the floating settings/gear button */}
        <h1
          className="text-[34px] md:text-5xl font-bold text-white mb-6 md:mb-8 flex items-center gap-3 md:gap-4 pr-14 md:pr-0"
          style={{ fontFamily: 'var(--font-impact)' }}
        >
          <Settings className="w-7 h-7 md:w-8 md:h-8 text-sakura shrink-0" />
          Paramètres
        </h1>

        <div className="max-w-2xl space-y-7">
          <AccountGroup />

          <Group title="Lecture">
            <Row label="Langue par défaut" stackOnMobile>
              <Segmented<Lang>
                label="Langue par défaut"
                value={settings.defaultLang}
                options={[
                  ['vostfr', 'VOSTFR'],
                  ['vf', 'VF'],
                ]}
                onChange={(v) => updateSettings({ defaultLang: v })}
              />
            </Row>
            <Toggle
              label="Passer l'opening et l'ending"
              hint="Automatiquement, avec les horaires communautaires AniSkip."
              checked={settings.autoSkip}
              onChange={(v) => updateSettings({ autoSkip: v })}
            />
            <Row label="Affichage des épisodes" hint="Automatique : liste sur téléphone, cartes sur ordinateur." stackOnMobile>
              <Segmented<EpisodeView>
                label="Affichage des épisodes"
                value={settings.episodeView ?? 'auto'}
                options={[
                  ['auto', 'Auto'],
                  ['cards', 'Cartes'],
                  ['list', 'Liste'],
                ]}
                onChange={(v) => updateSettings({ episodeView: v })}
              />
            </Row>
            <Toggle
              label="Épisode suivant automatique"
              hint="Après un compte à rebours de 8 s."
              checked={settings.autoNext}
              onChange={(v) => updateSettings({ autoNext: v })}
            />
          </Group>

          {touchDevice && (
          <Group title="Retour haptique" footer="Android (Chrome, Edge, Samsung Internet) et iPhone sous iOS 18 ou plus récent.">
            <Toggle label="Vibrations au toucher" checked={settings.haptics} onChange={(v) => updateSettings({ haptics: v })} />
            {settings.haptics && (
              <>
                <Row label="Intensité" stackOnMobile>
                  <Segmented<HapticIntensity>
                    label="Intensité des vibrations"
                    value={settings.hapticIntensity}
                    options={[
                      ['soft', 'Douce'],
                      ['normal', 'Normale'],
                      ['strong', 'Forte'],
                    ]}
                    onChange={(v) => {
                      updateSettings({ hapticIntensity: v });
                      // Apply now so the preview vibration already uses the new level.
                      setHapticIntensity(v);
                      haptic('medium');
                    }}
                    silent
                  />
                </Row>
                <HapticTest />
              </>
            )}
          </Group>
          )}

          <Group title="Données" footer={user ? 'Votre liste, votre historique et vos réglages sont synchronisés avec votre compte.' : 'Votre liste, votre historique et vos réglages sont stockés uniquement sur cet appareil.'}>
            <Row label="Nouveautés" hint="Ce qui a changé dans la dernière version.">
              <ActionButton onClick={openChangelog}>Voir</ActionButton>
            </Row>
            <Row label="Message de bienvenue" hint="Le réafficher maintenant.">
              <ActionButton
                onClick={() => {
                  localStorage.removeItem('hasSeenWelcome');
                  location.reload();
                }}
              >
                Revoir
              </ActionButton>
            </Row>
            <Row label="Historique de visionnage" hint="Efface aussi la ligne « Reprendre ».">
              <ActionButton
                destructive
                onClick={() => {
                  if (confirm('Effacer tout l’historique ?')) {
                    haptic('warning');
                    clearHistory();
                  }
                }}
              >
                Effacer
              </ActionButton>
            </Row>
          </Group>
        </div>
      </div>
    </AppLayout>
  );
}

/** Haptics only exist on touch devices: hide the section on mouse-driven computers. */
const COARSE = '(pointer: coarse)';
function useTouchDevice() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(COARSE);
      mq.addEventListener('change', cb);
      return () => mq.removeEventListener('change', cb);
    },
    () => window.matchMedia(COARSE).matches,
    () => false
  );
}

const HAPTIC_MESSAGES = {
  'vibration-ok': 'Vibration envoyée. Si vous ne sentez rien, désactivez le mode économie d’énergie et vérifiez que les vibrations au toucher sont activées dans les réglages Android.',
  'vibration-refused': 'Le navigateur a refusé la vibration. Elle est peut-être bloquée pour ce site (paramètres du site dans Chrome).',
  'ios-switch': 'Retour haptique déclenché. Il nécessite iOS 18 ou plus récent, dans Safari ou depuis l’écran d’accueil.',
  none: 'Ce navigateur ne permet pas les vibrations (Firefox, ordinateur, ancien iOS…). Sur Android, utilisez Chrome, Edge ou Samsung Internet.',
} as const;

function HapticTest() {
  const [result, setResult] = useState<keyof typeof HAPTIC_MESSAGES | null>(null);
  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between gap-4 min-h-[32px]">
        <span className="text-[15px] text-[#8E8E93]">Vous ne sentez rien ?</span>
        <ActionButton
          onClick={() => {
            const { support, accepted } = testHaptic();
            setResult(support === 'vibration' ? (accepted ? 'vibration-ok' : 'vibration-refused') : support);
          }}
        >
          Tester
        </ActionButton>
      </div>
      {result && (
        <p role="status" className="mt-3 text-[13px] leading-relaxed text-[#EBEBF5]/80 bg-white/5 rounded-xl px-3 py-2">
          {HAPTIC_MESSAGES[result]}
        </p>
      )}
    </div>
  );
}
