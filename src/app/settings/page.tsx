'use client';

import { PreviewChoice, TabBarPreview } from '@/components/settings/tab-bar-preview';
import { AppLayout } from '@/components/layout/app-layout';
import { useAuth } from '@/core/auth';
import { useAppStore, type EpisodeView, type Lang } from '@/core/store';
import { Settings } from '@/components/ui/icons';
import { haptic, testHaptic, setHapticIntensity, type HapticIntensity } from '@/lib/haptics';
import { useState, useSyncExternalStore } from 'react';
import { Group, Row, Segmented, ActionButton, Toggle } from '@/components/settings/grouped-list';
import { openChangelog } from '@/components/layout/changelog-popup';
import { AppGroup } from '@/components/settings/app-group';
import { AccountGroup } from '@/components/settings/account-group';
import { AdminGroup } from '@/components/settings/admin-group';
import { detectPlatform } from '@/lib/app-release';

const noopSubscribe = () => () => {};

export default function SettingsPage() {
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const clearHistory = useAppStore((s) => s.clearHistory);
  const { user } = useAuth();
  const touchDevice = useTouchDevice();
  const isIphone = useSyncExternalStore(
    noopSubscribe,
    () => detectPlatform(navigator.userAgent, navigator.maxTouchPoints) === 'ios',
    () => false
  );

  return (
    <AppLayout>
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 px-4 sm:px-6 md:pl-32 md:pr-10 pt-page md:pt-10 pb-10">
        {/* pr-14 on phones keeps the title clear of the floating settings/gear button */}
        <h1
          className="text-[34px] md:text-5xl font-bold text-sakura mb-6 md:mb-8 flex items-center gap-3 md:gap-4 pr-14 md:pr-0"
          style={{ fontFamily: 'var(--font-impact)' }}
        >
          <Settings className="w-7 h-7 md:w-8 md:h-8 text-sakura shrink-0" />
          Paramètres
        </h1>

        <div className="max-w-2xl space-y-7">
          <AccountGroup />
          <AdminGroup />
          <AppGroup />

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

          {/* Phones only: the tab bar doesn't exist from md up. */}
          <div className="md:hidden">
            <Group
              title="Apparence"
              footer={
                isIphone
                  ? 'Liquid Glass : le matériau translucide d’iOS 26 pour la barre d’onglets, les boutons flottants, les menus et les fenêtres. Le contenu ne change pas.'
                  : undefined
              }
            >
              <div className="px-4 py-3">
                <div className="text-[16px] text-white mb-3">Barre d’onglets</div>
                <PreviewChoice
                  label="Barre d’onglets"
                  value={(settings.tabLabels ?? true) ? 'labels' : 'icons'}
                  options={[
                    { value: 'labels', name: 'Avec les noms', preview: <TabBarPreview labels liquid={settings.uiStyle === 'liquid'} /> },
                    { value: 'icons', name: 'Icônes seules', preview: <TabBarPreview labels={false} liquid={settings.uiStyle === 'liquid'} /> },
                  ]}
                  onChange={(v) => updateSettings({ tabLabels: v === 'labels' })}
                />
              </div>
              {isIphone && (
                <div className="px-4 py-3">
                  <div className="text-[16px] text-white mb-3">Interface</div>
                  <PreviewChoice
                    label="Interface"
                    value={settings.uiStyle ?? 'default'}
                    options={[
                      { value: 'default', name: 'Par défaut', preview: <TabBarPreview labels={settings.tabLabels ?? true} liquid={false} /> },
                      { value: 'liquid', name: 'Liquid Glass', preview: <TabBarPreview labels={settings.tabLabels ?? true} liquid /> },
                    ]}
                    onChange={(v) => updateSettings({ uiStyle: v })}
                  />
                </div>
              )}
            </Group>
          </div>

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
  native: 'Retour haptique envoyé par l’application. Si vous ne sentez rien, vérifiez que les vibrations du système sont activées (Réglages › Sons et vibrations).',
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
