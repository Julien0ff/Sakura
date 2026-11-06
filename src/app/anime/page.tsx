'use client';

import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { fetchAniList, GET_ANIME_DETAILS } from '@/core/api/anilist';
import { AppLayout } from '@/components/layout/app-layout';
import { Play, ArrowLeft, Star, Calendar, MonitorPlay, Tags, Bookmark, BookmarkCheck, Check } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { formatScore, statusLabel } from '@/lib/anime';
import { useAppStore, progressKey, isWatched, type Lang } from '@/core/store';
import { PlayerOverlay, type PlayerSource } from '@/components/player/player-overlay';
import { getSkipTimes } from '@/core/api/aniskip';
import { useAmbientColor } from '@/lib/use-ambient-color';
import { readableOn } from '@/lib/color';
import { haptic } from '@/lib/haptics';
import { EasterEggDialog, HUNTER_EGG_SRC, isHunterXHunter, useRapidClicks } from '@/components/anime/easter-egg';
import { getTMDBDetails, getTMDBSeasonEpisodes } from '@/core/api/tmdb';

function AnimeDetailsContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  // Remount on id change so season/player/tab state resets when following a relation link.
  return <AnimeDetails key={id ?? ''} id={id} autoPlay={searchParams.get('play') === '1'} />;
}

function AnimeDetails({ id, autoPlay }: { id: string | null; autoPlay: boolean }) {
  const defaultLang = useAppStore((s) => s.settings.defaultLang);
  const watchlist = useAppStore((s) => s.watchlist);
  const toggleWatchlist = useAppStore((s) => s.toggleWatchlist);
  const addToHistory = useAppStore((s) => s.addToHistory);
  const history = useAppStore((s) => s.history);
  const progress = useAppStore((s) => s.progress);
  const saveProgress = useAppStore((s) => s.saveProgress);
  const settings = useAppStore((s) => s.settings);
  const requestIdRef = useRef(0);
  const autoPlayedRef = useRef(false);
  const [activeTab, setActiveTab] = useState<'episodes' | 'details' | 'relations'>('episodes');
  const [activeLang, setActiveLang] = useState<Lang>(defaultLang);
  const [activeSeason, setActiveSeason] = useState<number>(1);
  const [playingEpisode, setPlayingEpisode] = useState<any>(null);
  const [videoData, setVideoData] = useState<PlayerSource | null>(null);
  const [availableSources, setAvailableSources] = useState<PlayerSource[]>([]);
  const [isLoadingVideo, setIsLoadingVideo] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);

  const playEpisode = async (ep: any, currentAnime: any, lang: Lang = activeLang) => {
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
      let currentScraper = 'vostfree';
      let sources = await fetchFromScraper(currentScraper);
      
      if (!sources || sources.length === 0) {
        console.log('Vostfree failed, auto-falling back to arkanime');
        currentScraper = 'arkanime';
        sources = await fetchFromScraper('arkanime');
      }
      
      if (!sources || sources.length === 0) {
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
        setVideoError("Aucun lien vidéo trouvé pour cet épisode (ni sur Vostfree, ni sur Arkanime, ni sur AnimeSama).");
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
  const inWatchlist = watchlist.some((a) => a.id === anime.id);
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
            onProgress={(time, duration) => saveProgress(currentProgressKey, time, duration)}
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
            className="absolute inset-0"
            style={{
              maskImage: 'linear-gradient(to bottom, #000 0%, #000 50%, transparent 100%)',
              WebkitMaskImage: 'linear-gradient(to bottom, #000 0%, #000 50%, transparent 100%)',
            }}
          >
            <div data-sd="parallax" className="absolute inset-0">
              <picture>
                {anime.bannerImage && <source media="(min-width: 768px)" srcSet={anime.bannerImage} />}
                <img
                  src={eggActive ? HUNTER_EGG_SRC : anime.coverImage.extraLarge || anime.bannerImage}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover object-[center_25%] md:object-center"
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
          <div className="absolute top-6 left-6 md:left-[104px] z-20">
            <Link 
              href="/"
              aria-label="Retour à l'accueil"
              className="flex items-center justify-center w-10 h-10 rounded-full liquid-glass text-white hover:bg-white/10 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
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
                <button
                  onClick={() => {
                    haptic(inWatchlist ? 'light' : 'success');
                    toggleWatchlist({
                    id: anime.id,
                    title,
                    cover: anime.coverImage.extraLarge,
                    color: anime.coverImage.color,
                    score: anime.averageScore,
                    status: anime.status,
                  });
                  }}
                  aria-pressed={inWatchlist}
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 liquid-glass text-white h-12 md:h-auto px-6 md:py-2.5 rounded-full font-semibold text-[15px] hover:bg-white/15 transition-all duration-300 cursor-pointer"
                >
                  {inWatchlist ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
                  {inWatchlist ? 'Dans ma liste' : 'Ma liste'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Content Tabs */}
        <div role="tablist" className="flex items-center gap-6 border-b border-white/[0.06] mb-8 pl-6 pr-6 md:pl-32 overflow-x-auto scrollbar-none">
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

        <div className="pl-6 md:pl-32 pr-6 mb-16">
          <div className="w-full space-y-8">
            {activeTab === 'episodes' && (
              <div className="space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex flex-col gap-2">
                    <h2 className="text-xl font-bold text-white flex items-center gap-3">
                      Liste des épisodes
                    </h2>
                    {anime.tmdbSeasons && anime.tmdbSeasons.length > 0 && (
                      <div className="flex flex-wrap gap-2 pb-2 max-w-full">
                        {anime.tmdbSeasons.map((s: any) => (
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
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pr-2 pb-4">
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
                      return (
                        <button
                          key={ep.episode_number}
                          onClick={() => {
                            haptic('medium');
                            playEpisode(ep, anime);
                          }}
                          className={`flex flex-col gap-3 p-3 rounded-2xl bg-white/5 hover:bg-white/10 transition-all duration-300 group border text-left cursor-pointer ${
                            isLast ? 'border-white/15' : 'border-transparent hover:border-white/10'
                          } ${watched ? 'opacity-70 hover:opacity-100' : ''}`}
                        >
                          <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black/40">
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
                              <div className="w-12 h-12 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center shadow-lg shadow-black/50 group-hover:scale-110 transition-transform duration-300">
                                <Play className="w-5 h-5 text-white ml-1" fill="currentColor" />
                              </div>
                            </div>
                          </div>
                          <div className="font-semibold text-white text-[14px] line-clamp-2 px-1">
                            {ep.episode_number}. {ep.name}
                          </div>
                        </button>
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
                    <h3 className="font-bold text-white mb-3">Informations</h3>
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
                  {anime.relations?.edges?.filter((e: any) => e.node.type === 'ANIME').map((edge: any) => (
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
