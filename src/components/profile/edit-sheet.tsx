'use client';

/* eslint-disable @next/next/no-img-element -- banner preview (AniList / local SVG) */
import { useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowUp, ChevronRight, X } from '@/components/ui/icons';
import { Group, Toggle } from '@/components/settings/grouped-list';
import { BannerPicker } from '@/components/profile/banner-picker';
import { Sheet } from '@/components/ui/sheet';
import { BLOCK_LABELS, normalizeBlocks, type Block } from '@/core/tracking';
import { useAuth } from '@/core/auth';
import { supabase } from '@/lib/supabase';
import { DEFAULT_BANNERS } from '@/lib/banners';
import { haptic } from '@/lib/haptics';
import type { PublicProfile } from '@/lib/public-profile';

const iconButton = 'w-9 h-9 rounded-full bg-white/10 hover:bg-white/15 flex items-center justify-center text-white cursor-pointer transition-colors';

/** Owner-only sheet: public/private, blocks shown + order, banner. */
export function EditSheet({ profile, onClose, onSaved }: { profile: PublicProfile; onClose: () => void; onSaved: () => void }) {
  const { user } = useAuth();
  const [isPublic, setIsPublic] = useState(profile.is_public);
  const [blocks, setBlocks] = useState<Block[]>(() => normalizeBlocks(profile.blocks.map((b) => ({ id: b.id, visible: b.visible }))));
  const [view, setView] = useState<'main' | 'banner'>('main');
  const [banner, setBanner] = useState(() => ({
    id: profile.banner.id,
    url: profile.banner.url ?? DEFAULT_BANNERS.find((b) => b.id === profile.banner.id)?.url ?? DEFAULT_BANNERS[0].url,
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= blocks.length) return;
    haptic('selection');
    const next = [...blocks];
    [next[i], next[j]] = [next[j], next[i]];
    setBlocks(next);
  };

  return (
    <Sheet label="Modifier le profil" onClose={onClose} width="lg">
      {(close) => {
        const save = async () => {
          if (!supabase || !user) return;
          setSaving(true);
          setError(null);
          const { error: e } = await supabase.from('profiles').update({ is_public: isPublic, visibility: { blocks } }).eq('id', user.id);
          setSaving(false);
          if (e) {
            haptic('warning');
            setError('Impossible d’enregistrer. Réessayez.');
            return;
          }
          haptic('success');
          onSaved();
          close();
        };

        return (
          <>
            <div className="sticky -top-4 md:-top-6 z-10 -mx-4 md:-mx-7 -mt-4 md:-mt-6 px-4 md:px-7 pt-4 md:pt-6 pb-3 mb-3 bg-[#141416]/95 backdrop-blur-md flex items-center justify-between gap-3">
              {view === 'banner' ? (
                <button type="button" onClick={() => setView('main')} className="flex items-center gap-2 text-[17px] font-bold text-white cursor-pointer">
                  <span className={iconButton}>
                    <ArrowLeft className="w-4 h-4" />
                  </span>
                  Bannière
                </button>
              ) : (
                <h2 className="text-[20px] font-bold text-white">Modifier le profil</h2>
              )}
              <button type="button" onClick={close} aria-label="Fermer" className={iconButton}>
                <X className="w-4 h-4" />
              </button>
            </div>

            {view === 'banner' ? (
              <BannerPicker current={banner.id} onPicked={(id, url) => {
                setBanner({ id, url });
                onSaved();
              }} />
            ) : (
              <div className="animate-in fade-in-0 slide-in-from-left-4 duration-300">
                <div className="grid gap-6 md:grid-cols-2 md:gap-6 md:items-start">
                  <div className="space-y-6">
                    <Group title="Bannière">
                      <button type="button" onClick={() => setView('banner')} className="group w-full text-left cursor-pointer block p-2">
                        <span className="relative block aspect-[3/1] rounded-xl overflow-hidden">
                          <img src={banner.url} alt="" className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                          <span className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                          <span className="absolute left-3 bottom-2 right-3 flex items-center justify-between text-[14px] font-semibold text-white">
                            Changer de bannière <ChevronRight className="w-4 h-4" />
                          </span>
                        </span>
                      </button>
                    </Group>
                    <Group title="Visibilité" footer="Privé : vous seul voyez votre profil. Public : toute personne ayant le lien voit les blocs affichés.">
                      <Toggle label="Profil public" checked={isPublic} onChange={setIsPublic} />
                    </Group>
                  </div>

                  <Group title="Blocs" footer="Cochez ce que les visiteurs voient, et choisissez l’ordre.">
                    {blocks.map((b, i) => (
                      <div key={b.id} className="flex items-center gap-3 px-4 min-h-[52px]">
                        <input
                          type="checkbox"
                          id={`blk-${b.id}`}
                          checked={b.visible}
                          onChange={(e) => {
                            haptic('selection');
                            setBlocks(blocks.map((x) => (x.id === b.id ? { ...x, visible: e.target.checked } : x)));
                          }}
                          className="w-5 h-5 accent-[#30D158] cursor-pointer"
                        />
                        <label htmlFor={`blk-${b.id}`} className="flex-1 text-[16px] text-white cursor-pointer">
                          {BLOCK_LABELS[b.id]}
                        </label>
                        <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Monter ${BLOCK_LABELS[b.id]}`} className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white disabled:opacity-30 cursor-pointer">
                          <ArrowUp className="w-4 h-4" />
                        </button>
                        <button type="button" onClick={() => move(i, 1)} disabled={i === blocks.length - 1} aria-label={`Descendre ${BLOCK_LABELS[b.id]}`} className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white disabled:opacity-30 cursor-pointer">
                          <ArrowDown className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </Group>
                </div>

                {error && <p role="alert" className="mt-4 text-[13px] text-[#FF6961] px-1">{error}</p>}
                <div className="mt-6 flex md:justify-end">
                  <button type="button" onClick={save} disabled={saving} className="w-full md:w-56 h-12 rounded-full bg-white text-black font-bold text-[16px] disabled:opacity-50 cursor-pointer active:scale-[0.98] transition-transform">
                    {saving ? 'Enregistrement…' : 'Enregistrer'}
                  </button>
                </div>
              </div>
            )}
          </>
        );
      }}
    </Sheet>
  );
}
