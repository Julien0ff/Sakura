'use client';

import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { fetchAniList, GET_ANIME_DETAILS } from '@/core/api/anilist';
import { AppLayout } from '@/components/layout/app-layout';
import { Play, ArrowLeft, Star, Calendar, MonitorPlay, Tags, Bookmark, BookmarkCheck, Check } from '@/components/ui/icons';
import Link from 'next/link';
import { useState, useEffect, useRef, useCallback, useMemo, Suspense } from 'react';
import { useAnimePagePresence, useDiscordPresence, type Playback, type PresenceEpisode } from '@/components/desktop/use-discord-presence';
import { formatScore, statusLabel } from '@/lib/anime';
import { useAppStore, progressKey, isWatched, type Lang } from '@/core/store';
import { StatusPicker } from '@/components/anime/status-picker';
import { RatingPicker } from '@/components/anime/rating-picker';
import { Popover } from '@/components/ui/popover';
import { onEpisodeWatched } from '@/core/auto-track';
import { PlayerOverlay, type PlayerSource } from '@/components/player/player-overlay';
import { getSkipTimes } from '@/core/api/aniskip';
import { useBack } from '@/lib/nav-history';
import { extraEntries, isListedSeason, openingSeason } from '@/lib/seasons';
import { useAmbientColor } from '@/lib/use-ambient-color';
import { readableOn } from '@/lib/color';
import { haptic } from '@/lib/haptics';
import { EasterEggDialog, HUNTER_EGG_SRC, isHunterXHunter, useRapidClicks } from '@/components/anime/easter-egg';
import { getTMDBDetails, getTMDBSeasonEpisodes } from '@/core/api/tmdb';
import { cartoonMedia, isCartoonId, tmdbIdOf } from '@/lib/cartoons';

function AnimeDetailsContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  // Remount on id change so season/player/tab state resets when following a relation link.
  return <AnimeDetails key={id ?? ''} id={id} autoPlay={searchParams.get('play') === '1'} />;
}

/** Episode list layouts (Settings › Affichage des épisodes). `auto` = list on phones, cards from md. */
const EPISODE_LAYOUTS = {
  cards: {
    container: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4',
    item: 'flex flex-col gap-3 p-3',
    thumb: 'w-full',
    play: 'w-12 h-12',
    title: 'min-h-10',
    rating: 'bottom-[26px]',
  },
  list: {
    container: 'flex flex-col gap-2 xl:grid xl:grid-cols-2 xl:gap-3',
    item: 'flex flex-row items-center gap-3 p-2',
    thumb: 'w-32 md:w-40 shrink-0',
    play: 'w-8 h-8',
    title: '',
    rating: 'top-1/2 -translate-y-1/2',
  },
  auto: {
    container: 'flex flex-col gap-2 md:grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 md:gap-4',
    item: 'flex flex-row items-center gap-3 p-2 md:flex-col md:items-stretch md:p-3',
    thumb: 'w-32 shrink-0 md:w-full',
    play: 'w-8 h-8 md:w-12 md:h-12',
    title: 'md:min-h-10',
    rating: 'top-1/2 -translate-y-1/2 md:top-auto md:translate-y-0 md:bottom-[26px]',
  },
} as const;

function AnimeDetails({ id, autoPlay }: { id: string | null; autoPlay: boolean }) {
  const defaultLang = useAppStore((s) => s.settings.defaultLang);
  const watchlist = useAppStore((s) => s.watchlist);
  const setAnimeRating = useAppStore((s) => s.setAnimeRating);
  const rateEpisode = useAppStore((s) => s.rateEpisode);
  const episodeRatings = useAppStore((s) => s.episodeRatings);
  const addToHistory = useAppStore((s) => s.addToHistory);
  const history = useAppStore((s) => s.history);
  const progress = useAppStore((s) => s.progress);
  const saveProgress = useAppStore((s) => s.saveProgress);
  const settings = useAppStore((s) => s.settings);
  const goBack = useBack();
  const requestIdRef = useRef(0);
  const autoPlayedRef = useRef(false);
  const [activeTab, setActiveTab] = useState<'episodes' | 'details' | 'relations'>('episodes');
  // Cartoons are dubbed (Anime-Sama often has them in VF only).
  const [activeLang, setActiveLang] = useState<Lang>(isCartoonId(Number(id)) ? 'vf' : defaultLang);
  const [activeSeason, setActiveSeason] = useState<number>(1);
  const [playingEpisode, setPlayingEpisode] = useState<any>(null);
  const [videoData, setVideoData] = useState<PlayerSource | null>(null);
  const [availableSources, setAvailableSources] = useState<PlayerSource[]>([]);
  const [isLoadingVideo, setIsLoadingVideo] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);

  // When the current episode was started (Discord progress bar for embedded players).
  const [playerOpenedAt, setPlayerOpenedAt] = useState(0);
  const playEpisode = async (ep: any, currentAnime: any, lang: Lang = activeLang) => {
    setPlayerOpenedAt(Date.now());
    // Ignore results from a previous click if the user picked another episode meanwhile.
    const requestId = ++requestIdRef.current;
    const isStale = () => requestId !== requestIdRef.current;
    setPlayingEpisode(ep);
    addToHistory({
      id: currentAnime.id,
      title: currentAnime.tmdbTitle || currentAnime.title.english || currentAnime.title.romaji,
      cover: currentAnime.coverImage.extraLarge,
      color: currentAnime.coverImage.color,
      score: currentAnime.averageScore,
      status: currentAnime.status,
      episodeNumber: ep.episode_number,
      episodeName: ep.name,
      season: activeSeason,
      lang: lang,
    });
    setVideoData(null);
    setAvailableSources([]);
    setVideoError(null);
    setIsLoadingVideo(true);
    
    const fetchFromScraper = async (scraperName: string) => {
      const cleanTitle = (str: string) => {
        return (str || '')
          .toLowerCase()
          .replace(/×/g, ' x ')
          .replace(/\(\d{4}\)/g, '')
          .replace(/ \d+(st|nd|rd|th) Season/gi, '')
          .replace(/ Season \d+/gi, '')
          .replace(/ Saison \d+/gi, '')
          .replace(/ Part \d+/gi, '')
          .replace(/ Partie \d+/gi, '')
          .replace(/[:\-–—!?,.'"]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      };

      const titleRo = currentAnime.title?.romaji || '';
      const titleEn = currentAnime.title?.english || '';
      const titleFr = currentAnime.tmdbTitle || '';

      const cleanRo = cleanTitle(titleRo);
      const cleanEn = cleanTitle(titleEn);
      const cleanFr = cleanTitle(titleFr);

      const baseTitles = Array.from(new Set([cleanRo, cleanEn, cleanFr].filter(Boolean)));
      
      const queriesToTry: string[] = [];
      if (activeSeason > 1) {
        for (const t of baseTitles) {
          queriesToTry.push(`${t} saison ${activeSeason}`);
        }
      }
      for (const t of baseTitles) {
        queriesToTry.push(t);
      }

      const isTitleMatch = (resTitle: string) => {
        const cleanRes = cleanTitle(resTitle);
        if (!cleanRes) return false;
        for (const candidate of [cleanRo, cleanEn, cleanFr]) {
          if (!candidate) continue;
          if (candidate === cleanRes) return true;
          if (candidate.length >= 4 && cleanRes.includes(candidate)) return true;
          if (cleanRes.length >= 4 && candidate.includes(cleanRes)) return true;
        }
        return false;
      };

      let searchData: any[] = [];
      for (const query of queriesToTry) {
        try {
          const searchRes = await fetch(`/api/scraper?action=search&query=${encodeURIComponent(query)}&scraper=${scraperName}`);
          const data = await searchRes.json();
          if (Array.isArray(data) && data.length > 0) {
            searchData = data;
            break;
          }
        } catch {}
      }

      if (searchData && searchData.length > 0) {
        const strictMatches = searchData.filter((res: any) => isTitleMatch(res.title));

        if (strictMatches.length > 0) {
          let bestMatch = strictMatches.find((res: any) => {
            const t = res.title.toLowerCase();
            const u = res.url.toLowerCase();
            if (lang === 'vf') {
              return t.includes('vf') || t.includes('french') || u.includes('-vf-') || u.includes('french');
            } else {
              return t.includes('vostfr') || u.includes('-vostfr-');
            }
          });

          if (!bestMatch) {
            bestMatch = strictMatches[0];
          }

          if (bestMatch) {
            const epRes = await fetch(`/api/scraper?action=episodes&url=${encodeURIComponent(bestMatch.url)}&lang=${lang}&season=${activeSeason}`);
            const episodesList = await epRes.json();

            const matchedEp = Array.isArray(episodesList)
              ? episodesList.find((e: any) => Number(e.number) === Number(ep.episode_number))
              : undefined;

            if (matchedEp) {
              const resolveRes = await fetch(`/api/scraper?action=resolve&url=${encodeURIComponent(matchedEp.url)}`);
              const resolved = await resolveRes.json();
              if (Array.isArray(resolved) && resolved.length > 0 && resolved[0]?.url) {
                return resolved;
              }
            }
          }
        }
      }
      return null;
    };

    try {
      // Cartoons: only Anime-Sama has them.
      const cartoon = isCartoonId(currentAnime.id);
      let currentScraper = cartoon ? 'animesama' : 'vostfree';
      let sources = await fetchFromScraper(currentScraper);
      
      if (!cartoon && (!sources || sources.length === 0)) {
        console.log('Vostfree failed, auto-falling back to arkanime');
        currentScraper = 'arkanime';
        sources = await fetchFromScraper('arkanime');
      }
      
      if (!cartoon && (!sources || sources.length === 0)) {
        console.log('Arkanime failed, auto-falling back to animesama');
        currentScraper = 'animesama';
        sources = await fetchFromScraper('animesama');
      }

      if (isStale()) return;
      if (sources && sources.length > 0) {
        setAvailableSources(sources);
        const bestSource = sources.find((s: PlayerSource) => s.type === 'hls' || s.type === 'mp4') || sources[0];
        setVideoData(bestSource);
      } else {
        setVideoError(cartoon ? "Aucun lien vidéo trouvé pour cet épisode sur AnimeSama." : "Aucun lien vidéo trouvé pour cet épisode (ni sur Vostfree, ni sur Arkanime, ni sur AnimeSama).");
      }
    } catch (err) {
      console.error(err);
      if (!isStale()) setVideoError("Erreur lors de la connexion au serveur.");
    } finally {
      if (!isStale()) setIsLoadingVideo(false);
    }
  };

  const { data: anime, isLoading, error } = useQuery({
    queryKey: ['anime', id],
    queryFn: async () => {
      // Western cartoons: TMDB show, negative id (src/lib/cartoons.ts).
      if (isCartoonId(Number(id))) {
        const res = await fetch(`/api/tmdb/tv/${tmdbIdOf(Number(id))}?language=fr-FR&append_to_response=external_ids`);
        return res.ok ? cartoonMedia(await res.json()) : null;
      }
      const anilistData = await fetchAniList(GET_ANIME_DETAILS, { id: Number(id) });
      if (!anilistData?.Media) return null;
      
      const media = anilistData.Media;
      const tmdbData = await getTMDBDetails(media.title.english || media.title.romaji, media.seasonYear);
      
      return {
        ...media,
        tmdbId: tmdbData?.id,
        tmdbTitle: tmdbData?.title,
        tmdbDescription: tmdbData?.description,
        tmdbSeasons: tmdbData?.seasons,
        imdbId: tmdbData?.imdbId,
      };
    },
    enabled: !!id,
  });

  // Opening an anime (or a related one): the season it matches on TMDB — « Second Season » on
  // AniList is season 2 of the TMDB show — unless this anime was being watched in another season.
  const [seasonFor, setSeasonFor] = useState<number | null>(null);
  if (anime && seasonFor !== anime.id) {
    setSeasonFor(anime.id);
    const watching = history.find((h) => h.id === anime.id)?.season;
    setActiveSeason(watching ?? openingSeason(anime.tmdbSeasons ?? [], anime.startDate));
  }

  const { data: tmdbEpisodes, isLoading: isLoadingEpisodes } = useQuery({
    queryKey: ['tmdbEpisodes', anime?.tmdbId, activeSeason],
    queryFn: () => getTMDBSeasonEpisodes(anime.tmdbId, activeSeason),
    enabled: !!anime?.tmdbId && !!activeSeason,
  });

  // Episode list actually displayed (TMDB > AniList streaming > numbered fallback), normalised for playback.
  const episodeList: any[] = !anime
    ? []
    : tmdbEpisodes && tmdbEpisodes.length > 0
      ? tmdbEpisodes
      : anime.streamingEpisodes?.length > 0
        ? anime.streamingEpisodes.map((ep: any, i: number) => ({ name: ep.title, episode_number: i + 1, thumbnail: ep.thumbnail }))
        : Array.from({ length: anime.episodes || 12 }, (_, i) => ({ name: `Épisode ${i + 1}`, episode_number: i + 1 }));

  const nextEpisode = playingEpisode
    ? episodeList.find((e) => e.episode_number === playingEpisode.episode_number + 1)
    : null;

  // "Lecture" from the hero banner: resume the last watched episode, or start at episode 1.
  useEffect(() => {
    if (!autoPlay || autoPlayedRef.current || !anime || isLoadingEpisodes || episodeList.length === 0) return;
    autoPlayedRef.current = true;
    const last = history.find((h) => h.id === anime.id && h.season === activeSeason);
    const ep = (last && episodeList.find((e) => e.episode_number === last.episodeNumber)) || episodeList[0];
    playEpisode(ep, anime);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlay, anime, isLoadingEpisodes, episodeList.length]);

  useAmbientColor(anime?.coverImage?.color);

  // Easter egg (Hunter×Hunter only): 5 quick clicks on the poster swap it for a hidden
  // image and show it in a popup; 5 more quick clicks bring the original back.
  const hasEgg = isHunterXHunter(anime?.title);
  const [eggActive, setEggActive] = useState(false);
  const [eggOpen, setEggOpen] = useState(false);
  const toggleEgg = useCallback(() => {
    haptic('success');
    setEggActive((active) => {
      setEggOpen(!active);
      return !active;
    });
  }, []);
  const onPosterClick = useRapidClicks(toggleEgg, hasEgg);

  const closePlayer = useCallback(() => {
    requestIdRef.current++;
    setPlayingEpisode(null);
    setVideoData(null);
    setIsLoadingVideo(false);
  }, []);

  // Discord « Regarde … » (desktop app). Playback is tracked per episode/source; embedded iframe
  // players report nothing, so they show as playing without a time bar.
  const playbackKey = playingEpisode && videoData ? `${anime?.id}:${activeSeason}:${playingEpisode.episode_number}:${videoData.url}` : '';
  const [playbackState, setPlaybackState] = useState<Playback & { key: string }>({ key: '', playing: true, time: 0, duration: 0 });
  const playback: Playback = playbackState.key === playbackKey ? playbackState : { playing: true, time: 0, duration: 0 };
  const updatePlayback = (patch: Partial<Playback>) =>
    setPlaybackState((p) => ({ ...(p.key === playbackKey ? p : { playing: true, time: 0, duration: 0 }), ...patch, key: playbackKey }));
  const presenceEpisode = useMemo<PresenceEpisode | null>(
    () =>
      anime && playingEpisode && videoData
        ? {
            animeId: anime.id,
            title: anime.tmdbTitle || anime.title.english || anime.title.romaji,
            cover: anime.coverImage?.extraLarge || anime.coverImage?.large || null,
            season: activeSeason,
            multiSeason: (anime.tmdbSeasons?.length ?? 0) > 1,
            episode: playingEpisode.episode_number,
            lang: activeLang,
            // Minutes → seconds: TMDB episode runtime, else AniList's per-episode duration.
            estimatedLength: ((playingEpisode.runtime as number | undefined) || (anime.duration as number | undefined) || 0) * 60,
            openedAt: playerOpenedAt,
          }
        : null,
    [anime, playingEpisode, videoData, activeSeason, activeLang, playerOpenedAt]
  );
  const presencePlayback = useMemo(() => playback, [playback.playing, playback.time, playback.duration]); // eslint-disable-line react-hooks/exhaustive-deps
  useDiscordPresence(presenceEpisode, presencePlayback);
  useAnimePagePresence(
    anime ? { id: anime.id, title: anime.tmdbTitle || anime.title.english || anime.title.romaji, cover: anime.coverImage?.extraLarge || anime.coverImage?.large || null } : null
  );

  // AniSkip is keyed by MyAnimeList id + episode number of *this* AniList entry. TMDB seasons > 1
  // usually map to another AniList entry, so only look it up for season 1 / single-season shows.
  const skipEnabled = !!anime?.idMal && !!playingEpisode && (activeSeason === 1 || !(anime?.tmdbSeasons?.length > 1));
  const { data: skipTimes = [] } = useQuery({
    queryKey: ['aniskip', anime?.idMal, playingEpisode?.episode_number],
    queryFn: () => getSkipTimes(anime.idMal, playingEpisode.episode_number),
    enabled: skipEnabled,
    staleTime: Infinity,
  });


  if (isLoading) {
    return (
      <AppLayout>
        <div className="w-full h-[50vh] animate-pulse bg-white/5 rounded-3xl" />
      </AppLayout>
    );
  }

  if (error || !anime) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-[50vh]">
          <h1 className="text-2xl font-bold text-destructive">Impossible de charger cet anime.</h1>
          <Link href="/" className="mt-4 text-primary hover:underline">Retour à l&apos;accueil</Link>
        </div>
      </AppLayout>
    );
  }

  const animeColor = anime.coverImage.color || '#0A84FF';
  const title = anime.tmdbTitle || anime.title.english || anime.title.romaji;
  const rating = formatScore(anime.averageScore);
  const listEntry = watchlist.find((a) => a.id === anime.id);
  const epLayout = EPISODE_LAYOUTS[settings.episodeView ?? 'auto'];
  const extras = extraEntries(anime.relations?.edges);
  // Last episode watched in the current season → "Reprendre".
  const lastWatched = history.find((h) => h.id === anime.id && h.season === activeSeason);
  const resumeEpisode = lastWatched ? episodeList.find((e) => e.episode_number === lastWatched.episodeNumber) : undefined;
  const currentProgressKey = playingEpisode ? progressKey(anime.id, activeSeason, playingEpisode.episode_number) : '';

  return (
    <AppLayout>
      <div className="relative animate-in fade-in slide-in-from-bottom-4 duration-700">
        

        {playingEpisode && (
          <PlayerOverlay
            animeTitle={title}
            episodeLabel={`${(anime.tmdbSeasons?.length ?? 0) > 1 ? `S${activeSeason} · ` : ''}Épisode ${playingEpisode.episode_number}${
              playingEpisode.name && playingEpisode.name !== `Épisode ${playingEpisode.episode_number}` ? ` — ${playingEpisode.name}` : ''
            }`}
            color={animeColor}
            artwork={anime.coverImage?.extraLarge}
            poster={playingEpisode.still_path ? `https://image.tmdb.org/t/p/w1280${playingEpisode.still_path}` : anime.bannerImage}
            isLoading={isLoadingVideo}
            error={videoError}
            errorAction={
              activeLang === 'vf'
                ? {
                    label: 'Essayer en VOSTFR',
                    onClick: () => {
                      haptic('selection');
                      setActiveLang('vostfr');
                      playEpisode(playingEpisode, anime, 'vostfr');
                    },
                  }
                : {
                    label: 'Essayer en VF',
                    onClick: () => {
                      haptic('selection');
                      setActiveLang('vf');
                      playEpisode(playingEpisode, anime, 'vf');
                    },
                  }
            }
            sources={availableSources}
            current={videoData}
            onSelectSource={setVideoData}
            onClose={closePlayer}
            next={nextEpisode ? { label: `Épisode ${nextEpisode.episode_number} — ${nextEpisode.name}`, onPlay: () => playEpisode(nextEpisode, anime) } : null}
            autoNext={settings.autoNext}
            skipTimes={skipTimes}
            autoSkip={settings.autoSkip}
            startAt={progress[currentProgressKey]?.time ?? 0}
            episodeRating={episodeRatings[currentProgressKey]?.rating ?? null}
            onRateEpisode={(r) => rateEpisode(anime.id, activeSeason, playingEpisode.episode_number, r)}
            onPlayingChange={(playing) => updatePlayback({ playing })}
            onProgress={(time, duration) => {
              updatePlayback({ time, duration });
              // First crossing of the "watched" threshold → auto status / completion / banner unlock.
              const before = isWatched(useAppStore.getState().progress[currentProgressKey]);
              saveProgress(currentProgressKey, time, duration);
              if (!before && isWatched({ time, duration, updatedAt: 0 })) {
                onEpisodeWatched(
                  {
                    id: anime.id,
                    title,
                    cover: anime.coverImage.extraLarge,
                    color: anime.coverImage.color,
                    score: anime.averageScore,
                    status: anime.status,
                    anilistStatus: anime.status,
                    anilistEpisodes: anime.episodes,
                    tmdbSeasons: anime.tmdbSeasons,
                    bannerImage: anime.bannerImage,
                    popularity: anime.popularity,
                  },
                  activeSeason,
                  playingEpisode.episode_number
                );
              }
            }}
          />
        )}

        {/* Banner Section */}
        {hasEgg && <EasterEggDialog open={eggOpen} onClose={() => setEggOpen(false)} src={HUNTER_EGG_SRC} />}

        <div
          className="relative w-full h-[62svh] min-h-[420px] md:h-[60vh] md:min-h-[460px] max-h-[760px] mb-4 md:mb-6 overflow-hidden"
          // On phones the poster *is* the banner background, so the banner takes the taps.
          onClick={(e) => {
            if (window.matchMedia('(max-width: 767px)').matches) onPosterClick(e);
          }}
        >
          {/* Image (cover on phones, wide banner from md). The mask dissolves the bottom edge
              into the ambient color field so the banner melts into the page, no seam. */}
          <div
            data-sd="media"
            className="anime-hero-fade absolute inset-0"
          >
            <div data-sd="parallax" className="absolute inset-0">
              <picture>
                {anime.bannerImage && <source media="(min-width: 768px)" srcSet={anime.bannerImage} />}
                <img
                  src={eggActive ? HUNTER_EGG_SRC : anime.coverImage.extraLarge || anime.bannerImage}
                  alt=""
                  className="anime-hero-fade-img absolute inset-0 w-full h-full object-cover object-[center_25%] md:object-center"
                />
              </picture>
            </div>
          </div>

          {/* Legibility scrims: top (status bar / back button), left on desktop, tinted bottom fading to transparent */}
          <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/60 to-transparent" />
          <div
            className="absolute inset-0 hidden md:block bg-gradient-to-r from-black/75 via-black/20 to-transparent"
            style={{ maskImage: 'linear-gradient(to bottom, #000 55%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, #000 55%, transparent 100%)' }}
          />
          <div
            className="absolute inset-x-0 bottom-0 h-[80%]"
            style={{
              background: `linear-gradient(to top, transparent 0%, color-mix(in oklab, ${animeColor} 10%, rgba(0,0,0,0.5)) 25%, rgba(0,0,0,0.25) 60%, transparent 100%)`,
            }}
          />

          {/* Top Bar Navigation */}
          {/* Phones: below the status bar (same row as the account button), not under its blur. */}
          <div className="absolute top-float md:top-6 left-4 md:left-[104px] z-20">
            <button
              type="button"
              onClick={() => {
                haptic('selection');
                goBack();
              }}
              aria-label="Retour"
              className="flex items-center justify-center w-10 h-10 rounded-full liquid-glass text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          </div>

          <div
            data-sd="content"
            className="absolute bottom-0 left-0 w-full px-5 pb-6 md:py-10 md:pr-10 md:pl-32 flex flex-col md:flex-row gap-6 md:gap-10 items-start md:items-end z-20"
          >
            <div
              onClick={onPosterClick}
              className={`relative w-32 md:w-48 aspect-[2/3] rounded-2xl overflow-hidden shadow-2xl shrink-0 apple-squircle hidden md:block select-none ${
                hasEgg ? 'active:scale-[0.97] transition-transform' : ''
              }`}
            >
              <img
                key={eggActive ? 'egg' : 'cover'}
                src={eggActive ? HUNTER_EGG_SRC : anime.coverImage.extraLarge}
                alt={`Affiche de ${title}`}
                draggable={false}
                className="w-full h-full object-cover animate-in fade-in zoom-in-95 duration-500"
              />
            </div>
            
            <div className="flex flex-col gap-3 pb-2">
              <h1 
                className="text-[38px] leading-[0.95] md:text-5xl font-bold tracking-normal text-white drop-shadow-lg line-clamp-2 text-balance"
                style={{ fontFamily: 'var(--font-impact)' }}
              >
                {title}
              </h1>
              <div className="flex flex-wrap items-center gap-3">
                <span 
                  className="px-2.5 py-1 text-[13px] font-semibold rounded-md border text-white backdrop-blur-md"
                  style={{ backgroundColor: `${animeColor}30`, borderColor: `${animeColor}50` }}
                >
                  {anime.format || 'TV'}
                </span>
                {rating && (
                  <span className="flex items-center gap-1 text-[14px] font-bold text-white drop-shadow-md">
                    <Star className="w-4 h-4" style={{ color: animeColor }} fill={animeColor} />
                    {rating}
                  </span>
                )}
                {anime.episodes && (
                  <span className="flex items-center gap-1 text-[14px] font-medium text-[#EBEBF5]">
                    <MonitorPlay className="w-4 h-4 opacity-70" /> {anime.episodes} Épisodes
                  </span>
                )}
                {anime.status && (
                  <span className="flex items-center gap-1 text-[14px] font-medium text-[#EBEBF5]">
                    <Calendar className="w-4 h-4 opacity-70" /> {statusLabel(anime.status)}
                    {anime.seasonYear ? ` · ${anime.seasonYear}` : ''}
                  </span>
                )}
              </div>
              <div className="flex w-full md:w-auto items-center gap-3 mt-2">
                <button
                  onClick={() => {
                    const ep = resumeEpisode ?? episodeList[0];
                    if (!ep) return;
                    haptic('medium');
                    playEpisode(ep, anime);
                  }}
                  disabled={episodeList.length === 0}
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 text-white h-12 md:h-auto px-6 md:py-2.5 rounded-full font-bold text-[15px] hover:scale-105 active:scale-[0.98] transition-all duration-300 shadow-xl cursor-pointer disabled:opacity-50"
                  style={{ backgroundColor: animeColor, color: readableOn(animeColor), boxShadow: `0 10px 30px -8px ${animeColor}` }}
                >
                  <Play className="w-4 h-4" fill="currentColor" />
                  {resumeEpisode ? `Reprendre · Ép. ${resumeEpisode.episode_number}` : 'Regarder'}
                </button>
                <StatusPicker
                  anime={{
                    id: anime.id,
                    title,
                    cover: anime.coverImage.extraLarge,
                    color: anime.coverImage.color,
                    score: anime.averageScore,
                    status: anime.status,
                  }}
                  wrapperClassName="flex-1 md:flex-none"
                  className="w-full flex items-center justify-center gap-2 liquid-glass text-white h-12 md:h-auto px-6 md:py-2.5 rounded-full font-semibold text-[15px] hover:bg-white/15 transition-all duration-300 cursor-pointer"
                />
              </div>
              {listEntry && (
                <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3">
                  <span className="text-[13px] font-semibold text-[#8E8E93]">Ma note</span>
                  <RatingPicker value={listEntry.rating} onChange={(r) => setAnimeRating(anime.id, r)} label="Ma note pour cet anime" size="sm" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Content Tabs */}
        <div role="tablist" className="flex items-center gap-6 border-b border-white/[0.06] mb-8 px-6 md:pl-32 md:pr-10 overflow-x-auto scrollbar-none">
          {['episodes', 'details', 'relations'].map((tab) => (
            <button
              key={tab}
              onClick={() => { haptic('selection'); setActiveTab(tab as any); }}
              role="tab"
              aria-selected={activeTab === tab}
              className={`pb-3 whitespace-nowrap shrink-0 text-[15px] font-semibold transition-colors relative cursor-pointer ${
                activeTab === tab ? 'text-white' : 'text-[#8E8E93] hover:text-[#EBEBF5]'
              }`}
            >
              {tab === 'episodes' ? 'Épisodes' : tab === 'details' ? 'Détails' : 'Saisons & Relations'}
              {activeTab === tab && (
                <div 
                  className="absolute bottom-0 left-0 w-full h-0.5 rounded-t-full" 
                  style={{ backgroundColor: animeColor }}
                />
              )}
            </button>
          ))}
        </div>

        <div className="px-6 md:pl-32 md:pr-10 mb-16">
          <div className="w-full space-y-8">
            {activeTab === 'episodes' && (
              <div className="space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex flex-col gap-2">
                    <h2 className="text-xl font-bold text-white flex items-center gap-3">
                      Liste des épisodes
                    </h2>
                    {(anime.tmdbSeasons?.length > 0 || extras.length > 0) && (
                      <div className="flex flex-wrap gap-2 pb-2 max-w-full">
                        {(anime.tmdbSeasons ?? []).map((s: any) => (
                          <button
                            key={s.season_number}
                            onClick={() => { haptic('selection'); setActiveSeason(s.season_number); }}
                            className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-sm font-semibold transition-all cursor-pointer border ${
                              activeSeason === s.season_number 
                                ? 'bg-white/20 text-white border-white/20 shadow-md' 
                                : 'bg-transparent text-[#8E8E93] border-transparent hover:bg-white/5 hover:text-white'
                            }`}
                          >
                            {s.name}
                          </button>
                        ))}
                        {/* Films / OVAs of the show: their own page (and player), after the seasons. */}
                        {extras.map((x) => (
                          <Link
                            key={x.id}
                            href={`/anime?id=${x.id}`}
                            title={x.title}
                            onClick={() => haptic('selection')}
                            className="whitespace-nowrap px-3 py-1.5 rounded-lg text-sm font-semibold transition-all border bg-transparent text-[#8E8E93] border-transparent hover:bg-white/5 hover:text-white"
                          >
                            {x.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex bg-black/40 p-1 rounded-xl border border-white/10 backdrop-blur-md shrink-0 self-start md:self-auto">
                    <button 
                      onClick={() => { haptic('selection'); setActiveLang('vostfr'); }}
                      className={`px-4 py-1.5 rounded-lg font-semibold text-sm transition-all cursor-pointer ${
                        activeLang === 'vostfr' ? 'bg-white/20 text-white shadow-sm' : 'text-[#8E8E93] hover:text-white'
                      }`}
                    >
                      VOSTFR
                    </button>
                    <button 
                      onClick={() => { haptic('selection'); setActiveLang('vf'); }}
                      className={`px-4 py-1.5 rounded-lg font-semibold text-sm transition-all cursor-pointer ${
                        activeLang === 'vf' ? 'bg-white/20 text-white shadow-sm' : 'text-[#8E8E93] hover:text-white'
                      }`}
                    >
                      VF
                    </button>
                  </div>
                </div>
                
                <div className={`${epLayout.container} pb-4`}>
                  {isLoadingEpisodes ? (
                    Array.from({ length: 8 }, (_, i) => (
                      <div key={i} className="aspect-video rounded-2xl bg-white/5 animate-pulse" />
                    ))
                  ) : (
                    episodeList.map((ep: any) => {
                      const thumb = ep.still_path ? `https://image.tmdb.org/t/p/w500${ep.still_path}` : ep.thumbnail;
                      const epProgress = progress[progressKey(anime.id, activeSeason, ep.episode_number)];
                      const watched = isWatched(epProgress);
                      const isLast = lastWatched?.episodeNumber === ep.episode_number;
                      const pct = epProgress?.duration ? Math.min(100, (epProgress.time / epProgress.duration) * 100) : 0;
                      const epRating = episodeRatings[progressKey(anime.id, activeSeason, ep.episode_number)]?.rating ?? null;
                      return (
                        <div key={ep.episode_number} className="relative h-full">
                        <button
                          onClick={() => {
                            haptic('medium');
                            playEpisode(ep, anime);
                          }}
                          className={`w-full h-full ${epLayout.item} rounded-2xl bg-white/5 hover:bg-white/10 transition-all duration-300 group border text-left cursor-pointer ${
                            isLast ? 'border-white/15' : 'border-transparent hover:border-white/10'
                          } ${watched ? 'opacity-70 hover:opacity-100' : ''}`}
                        >
                          <div className={`relative ${epLayout.thumb} aspect-video rounded-xl overflow-hidden bg-black/40`}>
                            {thumb ? (
                              <img src={thumb} alt={ep.name} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-white/30 text-2xl font-bold" style={{ fontFamily: 'var(--font-impact)' }}>
                                {ep.episode_number}
                              </div>
                            )}
                            {(watched || isLast) && (
                              <span className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/65 text-[11px] font-semibold text-white backdrop-blur-md">
                                {watched ? <><Check className="w-3 h-3" strokeWidth={3} /> Vu</> : 'En cours'}
                              </span>
                            )}
                            {pct > 0 && (
                              <div className="absolute inset-x-0 bottom-0 h-1 bg-white/20" aria-label={`Regardé à ${Math.round(pct)} %`}>
                                <div className="h-full" style={{ width: `${pct}%`, backgroundColor: animeColor }} />
                              </div>
                            )}
                            <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-transparent transition-colors duration-300">
                              <div className={`${epLayout.play} rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center shadow-lg shadow-black/50 group-hover:scale-110 transition-transform duration-300`}>
                                <Play className="w-1/2 h-1/2 text-white ml-0.5" fill="currentColor" />
                              </div>
                            </div>
                          </div>
                          {/* Two lines reserved on cards: every card in a row has the same height and the
                              rating sits centred beside the title. */}
                          <div className={`min-w-0 font-semibold text-white text-[14px] leading-5 line-clamp-2 px-1 pr-12 ${epLayout.title}`}>
                            <span className="text-white/45 tabular-nums">{ep.episode_number}</span>
                            <span className="text-white/25 mx-1.5">·</span>
                            {ep.name}
                          </div>
                        </button>
                        {/* Rating sits outside the play button (no nested buttons). */}
                        <Popover
                          label={`Noter l’épisode ${ep.episode_number}`}
                          side="top"
                          align="end"
                          className={`!absolute right-3 ${epLayout.rating}`}
                          trigger={({ open, toggle }) => (
                            <button
                              type="button"
                              onClick={() => {
                                haptic('selection');
                                toggle();
                              }}
                              aria-expanded={open}
                              aria-label={epRating ? `Note : ${epRating} sur 10. Modifier` : `Noter l’épisode ${ep.episode_number}`}
                              className={`h-8 min-w-8 px-2 rounded-full flex items-center justify-center gap-1 text-[12px] font-bold cursor-pointer transition-colors ${
                                epRating ? 'bg-[#FFD60A] text-black' : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
                              }`}
                            >
                              <Star className="w-3.5 h-3.5" aria-hidden />
                              {epRating ?? null}
                            </button>
                          )}
                        >
                          {(close) => (
                            <div className="p-2 w-[min(80vw,300px)]">
                              <RatingPicker
                                value={epRating}
                                label={`Note de l’épisode ${ep.episode_number}`}
                                size="sm"
                                onChange={(r) => {
                                  rateEpisode(anime.id, activeSeason, ep.episode_number, r);
                                  close();
                                }}
                              />
                            </div>
                          )}
                        </Popover>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {activeTab === 'details' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                <div className="lg:col-span-2 space-y-8">
                  <div>
                    <h2 className="text-xl font-bold text-white mb-4">Synopsis</h2>
                    <p 
                      className="text-[#EBEBF5] text-[15px] leading-relaxed opacity-90"
                      dangerouslySetInnerHTML={{ __html: anime.tmdbDescription || anime.description || 'Aucune description disponible.' }}
                    />
                  </div>
                  
                  {anime.trailer?.id && (
                    <div>
                      <h2 className="text-xl font-bold text-white mb-4">Bande-annonce</h2>
                      <div className="aspect-video w-full rounded-2xl overflow-hidden shadow-xl border border-white/10">
                        <iframe 
                          src={`https://www.youtube.com/embed/${anime.trailer.id}`} 
                          className="w-full h-full"
                          allowFullScreen
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Sidebar (Genres & Infos) now inside details */}
                <div className="space-y-6">
                  <div className="p-5 rounded-2xl bg-white/5 border border-white/5">
                    <h3 className="font-bold text-white mb-3 flex items-center gap-2">
                      <Tags className="w-4 h-4 opacity-70" /> Genres
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {anime.genres?.map((g: string) => (
                        <span key={g} className="px-2.5 py-1 rounded-md bg-white/10 text-[#EBEBF5] text-xs font-medium">
                          {g}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="p-5 rounded-2xl bg-white/5 border border-white/5">
                    <h3 className="font-bold text-white mb-3 flex items-center gap-2">
                      <svg className="w-4 h-4 opacity-70" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path fillRule="evenodd" clipRule="evenodd" d="M12.0002 3.00012C13.4833 3.00013 14.7483 3.07262 15.8049 3.17883C18.5278 3.45259 20.5476 5.47159 20.8215 8.19446C20.9277 9.25118 21.0002 10.5168 21.0002 12.0001C21.0002 13.4832 20.9277 14.7482 20.8215 15.8048C20.5477 18.5279 18.5279 20.5476 15.8049 20.8214C14.7483 20.9276 13.4833 21.0001 12.0002 21.0001C10.5169 21.0001 9.25124 20.9277 8.19452 20.8214C5.47162 20.5475 3.45265 18.5278 3.17889 15.8048C3.07268 14.7482 3.00019 13.4832 3.00018 12.0001C3.00018 10.5168 3.07266 9.25118 3.17889 8.19446C3.4528 5.47171 5.47175 3.4527 8.19452 3.17883C9.25124 3.07259 10.5169 3.00012 12.0002 3.00012ZM12.0002 11.0001C11.4479 11.0001 11.0002 11.4478 11.0002 12.0001V17.0001C11.0002 17.5524 11.4479 18.0001 12.0002 18.0001C12.5523 18 13.0001 17.5523 13.0002 17.0001V12.0001C13.0002 11.4479 12.5524 11.0002 12.0002 11.0001ZM12.0002 7.00012C11.4479 7.00012 11.0002 7.44784 11.0002 8.00012C11.0002 8.55235 11.4479 9.00012 12.0002 9.00012C12.5523 9.00002 13.0001 8.55229 13.0002 8.00012C13.0002 7.4479 12.5524 7.00022 12.0002 7.00012Z" fill="currentColor"/>
                      </svg>
                      Informations
                    </h3>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-[#8E8E93]">Studio</span>
                        <span className="text-white font-medium">{anime.studios?.nodes?.[0]?.name || 'Inconnu'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#8E8E93]">Format</span>
                        <span className="text-white font-medium">{anime.format || 'TV'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#8E8E93]">Statut</span>
                        <span className="text-white font-medium">{statusLabel(anime.status, 'Inconnu')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#8E8E93]">Score AniList</span>
                        <span className="text-white font-medium">{anime.averageScore ? `${anime.averageScore}%` : 'Non noté'}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[#8E8E93]">IMDB</span>
                        {anime.imdbId ? (
                          <a 
                            href={`https://www.imdb.com/title/${anime.imdbId}/`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-white font-medium hover:text-primary transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            Voir sur IMDB ↗
                          </a>
                        ) : (
                          <span className="text-white/50 font-medium">Non dispo</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'relations' && (
              <div>
                <h2 className="text-xl font-bold text-white mb-4">Saisons et Médias Liés</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {anime.relations?.edges
                    // Seasons already listed under « Épisodes » (same TMDB show) don't get a card.
                    ?.filter((e: any) => e.node.type === 'ANIME' && !isListedSeason(e, anime.tmdbSeasons ?? []) && !extras.some((x) => x.id === e.node.id))
                    .map((edge: any) => (
                    <Link 
                      href={`/anime?id=${edge.node.id}`} 
                      key={edge.node.id}
                      className="group flex flex-col gap-2"
                    >
                      <div className="relative aspect-[2/3] w-full rounded-xl overflow-hidden apple-squircle">
                        <img 
                          src={edge.node.coverImage.extraLarge || edge.node.coverImage.large}
                          alt={edge.node.title.english || edge.node.title.romaji}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-primary mb-0.5">{edge.relationType.replace(/_/g, ' ')}</div>
                        <div className="text-sm text-white font-medium line-clamp-1">{edge.node.title.english || edge.node.title.romaji}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>

      </div>
    </AppLayout>
  );
}

export default function AnimeDetailsPage() {
  return (
    <Suspense fallback={<div className="w-full h-screen animate-pulse bg-background" />}>
      <AnimeDetailsContent />
    </Suspense>
  );
}
