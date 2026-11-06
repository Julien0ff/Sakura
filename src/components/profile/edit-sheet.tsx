'use client';

import { useState } from 'react';
import { ArrowDown, ArrowUp, ChevronRight, X } from '@/components/ui/icons';
import { Group, Row, Toggle } from '@/components/settings/grouped-list';
import { BannerPicker } from '@/components/profile/banner-picker';
import { BLOCK_LABELS, normalizeBlocks, type Block } from '@/core/tracking';
import { useAuth } from '@/core/auth';
import { supabase } from '@/lib/supabase';
import { haptic } from '@/lib/haptics';
import type { PublicProfile } from '@/lib/public-profile';

/** Owner-only sheet: public/private, blocks shown + order, banner. */
export function EditSheet({ profile, onClose, onSaved }: { profile: PublicProfile; onClose: () => void; onSaved: () => void }) {
  const { user } = useAuth();
  const [isPublic, setIsPublic] = useState(profile.is_public);
  const [blocks, setBlocks] = useState<Block[]>(() => normalizeBlocks(profile.blocks.map((b) => ({ id: b.id, visible: b.visible }))));
  const [view, setView] = useState<'main' | 'banner'>('main');
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
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-end md:items-center justify-center" role="dialog" aria-modal="true" aria-label="Modifier le profil">
      <button type="button" aria-label="Fermer" onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-default" />
      <div className="relative w-full md:max-w-lg max-h-[88dvh] overflow-y-auto rounded-t-[28px] md:rounded-[28px] bg-[#111] border border-white/10 p-4 pb-[max(env(safe-area-inset-bottom),16px)] animate-in slide-in-from-bottom-8 fade-in duration-200">
        <div className="flex items-center justify-between mb-4 px-1">
          {view === 'banner' ? (
            <button type="button" onClick={() => setView('main')} className="text-[15px] text-primary cursor-pointer">
              ‹ Retour
            </button>
          ) : (
            <h2 className="text-[17px] font-bold text-white">Modifier le profil</h2>
          )}
          <button type="button" onClick={onClose} aria-label="Fermer" className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {view === 'banner' ? (
          <BannerPicker
            current={profile.banner.id}
            onPicked={() => {
              onSaved();
              setView('main');
            }}
          />
        ) : (
          <div className="space-y-6">
            <Group title="Visibilité" footer="Privé : vous seul voyez votre profil. Public : toute personne ayant le lien voit les blocs affichés.">
              <Toggle label="Profil public" checked={isPublic} onChange={setIsPublic} />
            </Group>

            <Group title="Apparence">
              <button type="button" onClick={() => setView('banner')} className="w-full text-left cursor-pointer">
                <Row label="Bannière" hint="Par défaut ou débloquée en terminant des animes.">
                  <ChevronRight className="w-5 h-5 text-[#8E8E93]" />
                </Row>
              </button>
            </Group>

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
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Monter ${BLOCK_LABELS[b.id]}`} className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center text-white disabled:opacity-30 cursor-pointer">
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === blocks.length - 1} aria-label={`Descendre ${BLOCK_LABELS[b.id]}`} className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center text-white disabled:opacity-30 cursor-pointer">
                    <ArrowDown className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </Group>

            {error && <p role="alert" className="text-[13px] text-[#FF6961] px-1">{error}</p>}
            <button type="button" onClick={save} disabled={saving} className="w-full h-12 rounded-full bg-white text-black font-bold text-[16px] disabled:opacity-50 cursor-pointer">
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
