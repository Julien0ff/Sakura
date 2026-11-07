'use client';

import { AppLayout } from '@/components/layout/app-layout';
import { useAppStore, useHydrated } from '@/core/store';
import { Clock, Trash2, X } from '@/components/ui/icons';
import Link from 'next/link';
import { haptic } from '@/lib/haptics';

const dateFormatter = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });

export default function HistoryPage() {
  const hydrated = useHydrated();
  const history = useAppStore((s) => s.history);
  const removeFromHistory = useAppStore((s) => s.removeFromHistory);
  const clearHistory = useAppStore((s) => s.clearHistory);

  return (
    <AppLayout>
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 px-6 md:pl-32 pr-6 pt-page pb-32">
        <div className="flex items-center justify-between gap-4 mb-8 max-md:pr-12">
          <h1 className="text-4xl md:text-5xl font-bold text-white flex items-center gap-4" style={{ fontFamily: 'var(--font-impact)' }}>
            <Clock className="w-8 h-8 text-sakura" />
            Historique
          </h1>
          {hydrated && history.length > 0 && (
            <button
              onClick={() => {
                if (confirm('Effacer tout l’historique ?')) {
                  haptic('warning');
                  clearHistory();
                }
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-[#8E8E93] hover:text-white hover:bg-white/10 transition-colors text-sm cursor-pointer"
            >
              <Trash2 className="w-4 h-4" /> Tout effacer
            </button>
          )}
        </div>

        {!hydrated ? null : history.length === 0 ? (
          <div className="mt-12 text-center text-[#8E8E93] py-20">
            <p className="text-lg">Vous n&apos;avez pas encore regardé d&apos;épisodes.</p>
          </div>
        ) : (
          <ul className="space-y-3 max-w-3xl">
            {history.map((h) => (
              <li key={h.id} className="group flex items-center gap-4 p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-transparent hover:border-white/10 transition-colors">
                <Link href={`/anime?id=${h.id}`} className="flex items-center gap-4 flex-1 min-w-0">
                  {h.cover && <img src={h.cover} alt="" className="w-14 aspect-[2/3] object-cover rounded-lg shrink-0" loading="lazy" />}
                  <div className="min-w-0">
                    <div className="font-semibold text-white truncate">{h.title}</div>
                    <div className="text-sm text-[#EBEBF5]/80 truncate">
                      {h.season > 1 ? `Saison ${h.season} · ` : ''}Épisode {h.episodeNumber}
                      {h.episodeName && h.episodeName !== `Épisode ${h.episodeNumber}` ? ` — ${h.episodeName}` : ''}
                    </div>
                    <div className="text-xs text-[#8E8E93] mt-0.5">
                      {h.lang.toUpperCase()} · {dateFormatter.format(h.watchedAt)}
                    </div>
                  </div>
                </Link>
                <button
                  onClick={() => {
                    haptic('light');
                    removeFromHistory(h.id);
                  }}
                  aria-label={`Retirer ${h.title} de l'historique`}
                  className="p-2 rounded-full text-[#8E8E93] hover:text-white hover:bg-white/10 transition-colors cursor-pointer md:opacity-0 md:group-hover:opacity-100 focus:opacity-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppLayout>
  );
}
