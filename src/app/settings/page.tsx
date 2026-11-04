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
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 px-6 md:pl-32 pr-6 pt-10 pb-32">
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-8 flex items-center gap-4" style={{ fontFamily: 'var(--font-impact)' }}>
          <Settings className="w-8 h-8 text-primary" />
          Paramètres
        </h1>

        <div className="max-w-2xl space-y-6 mt-8">
          <section className="p-6 rounded-2xl bg-white/5 border border-white/10">
            <h2 className="text-xl font-bold text-white mb-4">Lecture</h2>
            <div className="space-y-4">
              <label className="flex items-center justify-between gap-4">
                <span className="text-white">Langue par défaut</span>
                <select
                  value={settings.defaultLang}
                  onChange={(e) => updateSettings({ defaultLang: e.target.value as Lang })}
                  className="bg-black/50 border border-white/20 rounded-lg px-4 py-2 text-white outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="vostfr">VOSTFR</option>
                  <option value="vf">VF</option>
                </select>
              </label>
              <Toggle
                label="Passer l'opening et l'ending automatiquement"
                hint="Utilise les horaires communautaires AniSkip quand ils existent."
                checked={settings.autoSkip}
                onChange={(v) => updateSettings({ autoSkip: v })}
              />
              <Toggle
                label="Épisode suivant automatique"
                hint="Lance l'épisode suivant après un compte à rebours de 8 s."
                checked={settings.autoNext}
                onChange={(v) => updateSettings({ autoNext: v })}
              />
              <Toggle
                label="Retour haptique"
                hint="Petites vibrations au toucher (Android, et iPhone sous iOS 18 ou plus)."
                checked={settings.haptics}
                onChange={(v) => updateSettings({ haptics: v })}
              />
              {settings.haptics && (
                <div className="flex items-center justify-between gap-4">
                  <span className="text-white">Intensité</span>
                  <div role="radiogroup" aria-label="Intensité des vibrations" className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-black/50 border border-white/10">
                    {(
                      [
                        ['soft', 'Douce'],
                        ['normal', 'Normale'],
                        ['strong', 'Forte'],
                      ] as [HapticIntensity, string][]
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        role="radio"
                        aria-checked={settings.hapticIntensity === value}
                        onClick={() => {
                          updateSettings({ hapticIntensity: value });
                          // Apply now so the preview vibration already uses the new level.
                          setHapticIntensity(value);
                          haptic('medium');
                        }}
                        className={`px-3 h-8 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                          settings.hapticIntensity === value ? 'bg-white text-black' : 'text-white/70 hover:text-white'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <HapticTest />
            </div>
          </section>

          <section className="p-6 rounded-2xl bg-white/5 border border-white/10">
            <h2 className="text-xl font-bold text-white mb-4">Données</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-white">Message de bienvenue</div>
                  <div className="text-sm text-[#8E8E93]">Le réafficher maintenant.</div>
                </div>
                <button
                  onClick={() => {
                    localStorage.removeItem('hasSeenWelcome');
                    location.reload();
                  }}
                  className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm cursor-pointer"
                >
                  Revoir
                </button>
              </div>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-white">Historique de visionnage</div>
                  <div className="text-sm text-[#8E8E93]">Stocké uniquement sur cet appareil.</div>
                </div>
                <button
                  onClick={() => {
                    if (confirm('Effacer tout l’historique ?')) clearHistory();
                  }}
                  className="px-4 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 text-sm cursor-pointer"
                >
                  Effacer
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </AppLayout>
  );
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-4 cursor-pointer">
      <span>
        <span className="block text-white">{label}</span>
        {hint && <span className="block text-sm text-[#8E8E93]">{hint}</span>}
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
  'vibration-ok': 'Vibration envoyée. Si vous ne sentez rien, vérifiez que le mode économie d’énergie est désactivé et que les vibrations au toucher sont activées dans les réglages Android.',
  'vibration-refused': 'Le navigateur a refusé la vibration. Elle est peut-être bloquée pour ce site (paramètres du site dans Chrome) ou par le navigateur.',
  'ios-switch': 'Retour haptique déclenché. Il nécessite iOS 18 ou plus récent, dans Safari ou depuis l’écran d’accueil.',
  none: 'Ce navigateur ne permet pas les vibrations (Firefox, ordinateur, ancien iOS…). Sur Android, utilisez Chrome, Edge ou Samsung Internet.',
} as const;

function HapticTest() {
  const [result, setResult] = useState<keyof typeof HAPTIC_MESSAGES | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm text-[#8E8E93]">Vous ne sentez rien ?</span>
        <button
          onClick={() => {
            const { support, accepted } = testHaptic();
            setResult(support === 'vibration' ? (accepted ? 'vibration-ok' : 'vibration-refused') : support);
          }}
          className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm cursor-pointer"
        >
          Tester
        </button>
      </div>
      {result && (
        <p role="status" className="text-[13px] leading-relaxed text-[#EBEBF5]/80 bg-white/5 rounded-xl px-3 py-2">
          {HAPTIC_MESSAGES[result]}
        </p>
      )}
    </div>
  );
}
