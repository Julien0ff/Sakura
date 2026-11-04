'use client';

import { AppLayout } from '@/components/layout/app-layout';
import { useAppStore, type Lang } from '@/core/store';
import { Settings } from 'lucide-react';
import { haptic, testHaptic, setHapticIntensity, type HapticIntensity } from '@/lib/haptics';
import { useState } from 'react';

export default function SettingsPage() {
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const clearHistory = useAppStore((s) => s.clearHistory);

  return (
    <AppLayout>
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 px-4 sm:px-6 md:pl-32 md:pr-10 pt-[max(env(safe-area-inset-top),24px)] md:pt-10 pb-10">
        {/* pr-14 on phones keeps the title clear of the floating settings/gear button */}
        <h1
          className="text-[34px] md:text-5xl font-bold text-white mb-6 md:mb-8 flex items-center gap-3 md:gap-4 pr-14 md:pr-0"
          style={{ fontFamily: 'var(--font-impact)' }}
        >
          <Settings className="w-7 h-7 md:w-8 md:h-8 text-primary shrink-0" />
          Paramètres
        </h1>

        <div className="max-w-2xl space-y-7">
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
            <Toggle
              label="Épisode suivant automatique"
              hint="Après un compte à rebours de 8 s."
              checked={settings.autoNext}
              onChange={(v) => updateSettings({ autoNext: v })}
            />
          </Group>

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

          <Group title="Données" footer="Votre liste, votre historique et vos réglages sont stockés uniquement sur cet appareil.">
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

/* ───────── Building blocks (iOS-style grouped list) ───────── */

function Group({ title, footer, children }: { title: string; footer?: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="px-4 mb-2 text-[13px] font-semibold uppercase tracking-wide text-[#8E8E93]">{title}</h2>
      <div className="rounded-2xl bg-white/[0.06] border border-white/[0.08] overflow-hidden divide-y divide-white/[0.08]">{children}</div>
      {footer && <p className="px-4 mt-2 text-[13px] leading-snug text-[#8E8E93]">{footer}</p>}
    </section>
  );
}

function Row({
  label,
  hint,
  stackOnMobile = false,
  children,
}: {
  label: string;
  hint?: string;
  /** Put the control under the label on phones (wide controls like segmented pickers). */
  stackOnMobile?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`flex gap-3 px-4 py-3 min-h-[56px] ${
        stackOnMobile ? 'flex-col sm:flex-row sm:items-center sm:justify-between sm:gap-4' : 'items-center justify-between gap-4'
      }`}
    >
      <div className="min-w-0">
        <div className="text-[16px] text-white">{label}</div>
        {hint && <div className="text-[13px] leading-snug text-[#8E8E93] mt-0.5">{hint}</div>}
      </div>
      <div className={stackOnMobile ? 'w-full sm:w-auto shrink-0' : 'shrink-0'}>{children}</div>
    </div>
  );
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  silent = false,
}: {
  label: string;
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
  /** Skip the default selection haptic (the caller plays its own). */
  silent?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="grid gap-1 p-1 rounded-xl bg-black/40 border border-white/10 w-full sm:w-auto sm:min-w-[240px]"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map(([v, text]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => {
            if (!silent) haptic('selection');
            onChange(v);
          }}
          className={`h-9 px-3 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors cursor-pointer ${
            value === v ? 'bg-white text-black shadow-sm' : 'text-white/70 hover:text-white'
          }`}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

function ActionButton({ children, onClick, destructive = false }: { children: React.ReactNode; onClick: () => void; destructive?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`h-9 px-4 rounded-lg text-sm font-semibold whitespace-nowrap cursor-pointer transition-colors ${
        destructive ? 'bg-red-500/15 hover:bg-red-500/25 text-[#FF6961]' : 'bg-white/10 hover:bg-white/20 text-white'
      }`}
    >
      {children}
    </button>
  );
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-4 px-4 py-3 min-h-[56px] cursor-pointer active:bg-white/[0.03]">
      <span className="min-w-0">
        <span className="block text-[16px] text-white">{label}</span>
        {hint && <span className="block text-[13px] leading-snug text-[#8E8E93] mt-0.5">{hint}</span>}
      </span>
      <span className="relative shrink-0">
        <input
          type="checkbox"
          role="switch"
          className="peer sr-only"
          checked={checked}
          onChange={(e) => {
            onChange(e.target.checked);
            haptic('selection');
          }}
        />
        <span className="block w-[51px] h-[31px] rounded-full bg-white/15 peer-checked:bg-[#30D158] transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-primary" />
        <span className="absolute top-[2px] left-[2px] w-[27px] h-[27px] rounded-full bg-white shadow-md transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
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
