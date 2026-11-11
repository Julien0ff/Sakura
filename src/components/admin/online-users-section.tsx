'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useOnlineUsers, type ActivePresencePayload } from '@/lib/online-presence';
import { AppIcon, Crown, MonitorPlay, Phone, Play, User, UserRound } from '@/components/ui/icons';

const card = 'rounded-3xl bg-[#1C1C1E]/90 border border-white/[0.08] backdrop-blur-xl shadow-2xl';
const sectionTitle = 'text-[11px] font-semibold uppercase tracking-wider text-[#8E8E93] mb-3 px-1';

function timeAgo(epochMs: number): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - epochMs) / 1000));
  if (diffSec < 10) return 'À l\'instant';
  if (diffSec < 60) return `Il y a ${diffSec}s`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `Il y a ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  return `Il y a ${diffH}h`;
}

function DeviceBadge({ device }: { device: ActivePresencePayload['device'] }) {
  const isPhone = device.type === 'mobile' || device.type === 'tablet';
  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.06] text-white/80 text-xs font-medium border border-white/[0.06]">
      {isPhone ? <Phone className="w-3.5 h-3.5 text-white/60" /> : <AppIcon className="w-3.5 h-3.5 text-white/60" />}
      <span>{device.label}</span>
    </div>
  );
}

export function OnlineUsersSection() {
  const { users, total, membersCount, guestsCount, isConnected } = useOnlineUsers();
  const [filter, setFilter] = useState<'all' | 'members' | 'guests'>('all');

  const filtered = users.filter((u) => {
    if (filter === 'members') return !u.isAnonymous;
    if (filter === 'guests') return u.isAnonymous;
    return true;
  });

  return (
    <section>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 px-1">
        <div className="flex items-center gap-2.5">
          <h2 className={sectionTitle.replace('mb-3 px-1', '')}>Utilisateurs en direct</h2>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>{total} en ligne</span>
          </div>
          {!isConnected && (
            <span className="text-xs text-amber-400/80">(connexion…)</span>
          )}
        </div>

        {/* Filter chips */}
        <div className="flex items-center gap-1 p-1 rounded-full bg-white/[0.06] border border-white/[0.06] text-xs font-medium self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded-full transition-colors cursor-pointer ${
              filter === 'all' ? 'bg-white text-black font-semibold' : 'text-white/70 hover:text-white'
            }`}
          >
            Tous ({total})
          </button>
          <button
            type="button"
            onClick={() => setFilter('members')}
            className={`px-3 py-1 rounded-full transition-colors cursor-pointer ${
              filter === 'members' ? 'bg-white text-black font-semibold' : 'text-white/70 hover:text-white'
            }`}
          >
            Membres ({membersCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter('guests')}
            className={`px-3 py-1 rounded-full transition-colors cursor-pointer ${
              filter === 'guests' ? 'bg-white text-black font-semibold' : 'text-white/70 hover:text-white'
            }`}
          >
            Invités ({guestsCount})
          </button>
        </div>
      </div>

      <div className={`${card} overflow-hidden divide-y divide-white/[0.08]`}>
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#8E8E93]">
            {total === 0 ? 'Aucun utilisateur connecté pour le moment.' : 'Aucun utilisateur ne correspond à ce filtre.'}
          </div>
        ) : (
          filtered.map((u) => {
            const isPlaying = Boolean(u.activity?.isPlaying);

            return (
              <div key={u.key} className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors">
                {/* User Identity */}
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="relative shrink-0">
                    {u.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={u.avatarUrl} alt="" className="w-11 h-11 rounded-full object-cover border border-white/10" />
                    ) : (
                      <div className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm ${
                        u.isAnonymous ? 'bg-white/10 text-white/50 border border-white/5' : 'bg-gradient-to-br from-purple-500/30 to-pink-500/30 text-white border border-white/15'
                      }`}>
                        {u.isAnonymous ? <UserRound className="w-5 h-5 text-white/40" /> : (u.username[0]?.toUpperCase() || <User className="w-5 h-5" />)}
                      </div>
                    )}
                    {/* Live green dot indicator */}
                    <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-[#1C1C1E]" title="En ligne" />
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-white text-[15px] truncate">{u.username}</span>
                      {u.isAdmin ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold uppercase tracking-wider">
                          <Crown className="w-3 h-3" />
                          Admin
                        </span>
                      ) : u.isAnonymous ? (
                        <span className="px-2 py-0.5 rounded-md bg-white/[0.08] text-white/60 text-[10px] font-semibold uppercase tracking-wider">
                          Invité
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md bg-blue-500/15 text-blue-300 border border-blue-500/20 text-[10px] font-semibold uppercase tracking-wider">
                          Membre
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mt-1 text-xs text-[#8E8E93]">
                      <span>Actif {timeAgo(u.lastSeenAt)}</span>
                      <span>·</span>
                      <DeviceBadge device={u.device} />
                    </div>
                  </div>
                </div>

                {/* Activity Status */}
                <div className="flex items-center gap-2 md:self-center shrink-0">
                  {isPlaying ? (
                    <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs font-medium">
                      <Play className="w-3.5 h-3.5 text-emerald-400 shrink-0 fill-current animate-pulse" />
                      <div className="min-w-0 text-left">
                        <div className="font-semibold text-white truncate max-w-[240px] sm:max-w-[320px]">{u.activity.title}</div>
                        {u.activity.details && <div className="text-[11px] text-emerald-400/80 truncate">{u.activity.details}</div>}
                      </div>
                      {u.activity.path && (
                        <Link
                          href={u.activity.path}
                          className="ml-1 p-1 rounded-lg hover:bg-emerald-500/20 text-emerald-200 transition-colors"
                          title="Voir la page"
                        >
                          <MonitorPlay className="w-4 h-4" />
                        </Link>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-white/80 text-xs">
                      <span className="text-white/40">Page :</span>
                      <span className="font-medium text-white/90 truncate max-w-[200px] sm:max-w-[280px]">
                        {u.activity.title}
                        {u.activity.details && u.activity.details !== u.activity.title ? ` (${u.activity.details})` : ''}
                      </span>
                      {u.activity.path && u.activity.path !== '/' && (
                        <Link
                          href={u.activity.path}
                          className="ml-1 text-white/40 hover:text-white transition-colors"
                          title="Ouvrir la page"
                        >
                          ↗
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

