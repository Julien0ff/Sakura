'use client';

import { useState, useEffect } from 'react';
import { toast } from '@/components/ui/toast';
import { haptic } from '@/lib/haptics';
import { Check, Bell, Share2, Sparkles } from '@/components/ui/icons';
import type { DiscordWebhooksConfig } from '@/app/api/admin/discord/route';

const card = 'rounded-2xl bg-white/[0.06] border border-white/[0.08]';
const inputStyle =
  'w-full h-11 px-3.5 rounded-xl bg-black/40 border border-white/10 text-[14px] text-white placeholder:text-white/30 outline-none focus:border-sakura/70 font-mono transition-colors';

export function DiscordWebhooksSection() {
  const [config, setConfig] = useState<DiscordWebhooksConfig>({
    episodesUrl: '',
    episodesEnabled: true,
    animesUrl: '',
    animesEnabled: true,
    changelogUrl: '',
    changelogEnabled: true,
    linksUrl: '',
    linksEnabled: true,
    rulesUrl: '',
    rulesEnabled: true,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [dispatching, setDispatching] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/discord')
      .then((res) => res.json())
      .then((data) => {
        if (data && typeof data === 'object') {
          setConfig((prev) => ({ ...prev, ...data }));
        }
      })
      .catch((e) => console.warn('Failed to load discord webhooks config', e))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/discord', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save', ...config }),
      });
      const data = await res.json();
      if (data.ok) {
        haptic('success');
        toast('Paramètres des webhooks enregistrés avec succès !');
      } else {
        toast(`Erreur : ${data.error || 'Impossible d’enregistrer'}`);
      }
    } catch {
      toast('Erreur de connexion au serveur');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (target: string, url: string) => {
    if (!url.trim()) {
      toast('Veuillez renseigner l’URL du webhook avant de tester.');
      return;
    }
    setTesting(target);
    try {
      const res = await fetch('/api/admin/discord', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test', target, url }),
      });
      const data = await res.json();
      if (data.ok) {
        haptic('success');
        toast('Message de test envoyé sur Discord !');
      } else {
        toast(`Échec du test : ${data.error || 'Erreur inconnue'}`);
      }
    } catch {
      toast('Erreur de communication avec Discord');
    } finally {
      setTesting(null);
    }
  };

  const handleDispatch = async (action: 'send_changelog' | 'send_links' | 'send_rules', url: string, label: string) => {
    if (!url.trim()) {
      toast(`Veuillez renseigner l’URL du webhook pour ${label}.`);
      return;
    }
    setDispatching(action);
    try {
      const res = await fetch('/api/admin/discord', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, url }),
      });
      const data = await res.json();
      if (data.ok) {
        haptic('success');
        toast(`Embed « ${label} » publié avec succès sur Discord !`);
      } else {
        toast(`Erreur lors de la publication : ${data.error || 'Erreur'}`);
      }
    } catch {
      toast('Erreur de communication avec Discord');
    } finally {
      setDispatching(null);
    }
  };

  if (loading) {
    return <div className={`${card} h-48 animate-pulse`} />;
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[17px] font-semibold text-white flex items-center gap-2">
            <span className="text-[#5865F2] font-bold">#</span>
            Webhooks Discord
          </h2>
          <p className="text-[13px] text-[#8E8E93]">
            Configurez les canaux Discord pour la diffusion automatique et manuelle des annonces.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2 rounded-full bg-sakura text-black font-semibold text-[13px] cursor-pointer hover:bg-sakura/90 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-1.5 shadow-lg shadow-sakura/20"
        >
          <Check className="w-3.5 h-3.5" />
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>

      <div className="space-y-3.5">
        {/* 1. Nouveaux Épisodes */}
        <WebhookItem
          title="Nouveaux Épisodes"
          description="Publie une notification avec thumbnail et lecteur direct à chaque sortie d’un nouvel épisode."
          icon="🎬"
          url={config.episodesUrl}
          enabled={config.episodesEnabled}
          onUrlChange={(v) => setConfig((c) => ({ ...c, episodesUrl: v }))}
          onToggle={(v) => setConfig((c) => ({ ...c, episodesEnabled: v }))}
          onTest={() => handleTest('episodes', config.episodesUrl)}
          testing={testing === 'episodes'}
        />

        {/* 2. Nouveaux Animes */}
        <WebhookItem
          title="Nouveaux Animes"
          description="Annonce l’ajout d’un nouvel anime au catalogue avec synopsis, note et bannière."
          icon="🌸"
          url={config.animesUrl}
          enabled={config.animesEnabled}
          onUrlChange={(v) => setConfig((c) => ({ ...c, animesUrl: v }))}
          onToggle={(v) => setConfig((c) => ({ ...c, animesEnabled: v }))}
          onTest={() => handleTest('animes', config.animesUrl)}
          testing={testing === 'animes'}
        />

        {/* 3. Changelogs automatiques */}
        <WebhookItem
          title="Changelogs & Mises à Jour"
          description="Diffuse la liste détaillée des nouveautés et corrections à chaque nouvelle mise à jour."
          icon="🚀"
          url={config.changelogUrl}
          enabled={config.changelogEnabled}
          onUrlChange={(v) => setConfig((c) => ({ ...c, changelogUrl: v }))}
          onToggle={(v) => setConfig((c) => ({ ...c, changelogEnabled: v }))}
          onTest={() => handleTest('changelog', config.changelogUrl)}
          testing={testing === 'changelog'}
          extraAction={{
            label: dispatching === 'send_changelog' ? 'Envoi…' : 'Envoyer le changelog v0.5.2',
            onClick: () => handleDispatch('send_changelog', config.changelogUrl, 'Changelog'),
            disabled: !config.changelogUrl.trim() || dispatching !== null,
          }}
        />

        {/* 4. Liens Utiles */}
        <WebhookItem
          title="Liens Utiles du Projet"
          description="Affiche le message récapitulatif des liens du site, des applications mobiles et du dépôt GitHub."
          icon="🔗"
          url={config.linksUrl}
          enabled={config.linksEnabled}
          onUrlChange={(v) => setConfig((c) => ({ ...c, linksUrl: v }))}
          onToggle={(v) => setConfig((c) => ({ ...c, linksEnabled: v }))}
          onTest={() => handleTest('links', config.linksUrl)}
          testing={testing === 'links'}
          extraAction={{
            label: dispatching === 'send_links' ? 'Envoi…' : 'Diffuser les liens utiles',
            onClick: () => handleDispatch('send_links', config.linksUrl, 'Liens Utiles'),
            disabled: !config.linksUrl.trim() || dispatching !== null,
          }}
        />

        {/* 5. Règlement du Serveur */}
        <WebhookItem
          title="Règlement du Serveur"
          description="Publie la charte communautaire et les règles de bonne conduite aux couleurs de SAKURA."
          icon="📜"
          url={config.rulesUrl}
          enabled={config.rulesEnabled}
          onUrlChange={(v) => setConfig((c) => ({ ...c, rulesUrl: v }))}
          onToggle={(v) => setConfig((c) => ({ ...c, rulesEnabled: v }))}
          onTest={() => handleTest('rules', config.rulesUrl)}
          testing={testing === 'rules'}
          extraAction={{
            label: dispatching === 'send_rules' ? 'Envoi…' : 'Publier le règlement',
            onClick: () => handleDispatch('send_rules', config.rulesUrl, 'Règlement'),
            disabled: !config.rulesUrl.trim() || dispatching !== null,
          }}
        />
      </div>
    </section>
  );
}

interface WebhookItemProps {
  title: string;
  description: string;
  icon: string;
  url: string;
  enabled: boolean;
  onUrlChange: (url: string) => void;
  onToggle: (enabled: boolean) => void;
  onTest: () => void;
  testing: boolean;
  extraAction?: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
  };
}

function WebhookItem({
  title,
  description,
  icon,
  url,
  enabled,
  onUrlChange,
  onToggle,
  onTest,
  testing,
  extraAction,
}: WebhookItemProps) {
  const [showUrl, setShowUrl] = useState(false);

  return (
    <div className={`${card} p-4 space-y-3 transition-colors ${enabled ? 'border-white/[0.12]' : 'opacity-70'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="text-xl shrink-0">{icon}</span>
          <div>
            <div className="text-[15px] font-semibold text-white flex items-center gap-2">
              {title}
              {!enabled && <span className="text-[11px] font-normal text-[#8E8E93] bg-white/5 px-2 py-0.5 rounded-full">Désactivé</span>}
            </div>
            <p className="text-[12px] text-[#8E8E93] mt-0.5">{description}</p>
          </div>
        </div>

        {/* Toggle switch */}
        <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
          <input type="checkbox" checked={enabled} onChange={(e) => onToggle(e.target.checked)} className="sr-only peer" />
          <div className="w-11 h-6 bg-white/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#5865F2]" />
        </label>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
        <div className="relative flex-1">
          <input
            type={showUrl ? 'text' : 'password'}
            value={url}
            onChange={(e) => onUrlChange(e.target.value)}
            placeholder="https://discord.com/api/webhooks/..."
            className={inputStyle}
          />
          {url && (
            <button
              type="button"
              onClick={() => setShowUrl((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-white/50 hover:text-white cursor-pointer px-1 py-0.5"
            >
              {showUrl ? 'Masquer' : 'Afficher'}
            </button>
          )}
        </div>

        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            disabled={testing || !url.trim()}
            onClick={onTest}
            className="px-3.5 h-11 rounded-xl bg-white/10 hover:bg-white/15 active:scale-95 text-[13px] font-medium text-white transition-all disabled:opacity-40 cursor-pointer"
          >
            {testing ? 'Test en cours…' : 'Tester'}
          </button>

          {extraAction && (
            <button
              type="button"
              disabled={extraAction.disabled}
              onClick={extraAction.onClick}
              className="px-3.5 h-11 rounded-xl bg-[#5865F2] hover:bg-[#4752C4] active:scale-95 text-[13px] font-medium text-white transition-all disabled:opacity-40 cursor-pointer"
            >
              {extraAction.label}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

