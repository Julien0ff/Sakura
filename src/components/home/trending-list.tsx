'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchAniList, GET_TRENDING_ANIMES } from '@/core/api/anilist';
import { Play } from '@/components/ui/icons';
import Image from 'next/image';

export function TrendingList() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['trending-animes'],
    queryFn: () => fetchAniList(GET_TRENDING_ANIMES, { page: 1, perPage: 12 }),
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6 animate-pulse">
        {[...Array(12)].map((_, i) => (
          <div key={i} className="aspect-[2/3] bg-white/[0.03] apple-squircle" />
        ))}
      </div>
    );
  }

  if (error || !data) {
    return <div className="text-destructive font-medium">Erreur lors du chargement des données.</div>;
  }

  const animes = data.Page.media;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
      {animes.map((anime: any) => (
        <div key={anime.id} className="group flex flex-col gap-3 cursor-pointer">
          <div className="relative w-full aspect-[2/3] apple-squircle overflow-hidden border border-white/[0.05] shadow-lg transition-transform duration-400 group-hover:scale-[1.03] group-hover:shadow-xl group-hover:shadow-primary/20">
            <Image 
              src={anime.coverImage.extraLarge || anime.coverImage.large} 
              alt={anime.title.romaji}
              fill
              className="object-cover"
              unoptimized
            />
            
            {/* Play Button Overlay */}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
              <div className="w-14 h-14 rounded-full liquid-glass flex items-center justify-center pl-1 shadow-2xl scale-75 group-hover:scale-100 transition-transform duration-300 ease-out">
                <Play className="w-6 h-6 text-white" fill="currentColor" />
              </div>
            </div>
          </div>
          
          <div className="px-1">
            <h3 className="text-white font-semibold line-clamp-1 text-[15px] tracking-tight">
              {anime.title.romaji || anime.title.english}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[13px] text-[#8E8E93] font-medium">{anime.format || 'TV'}</span>
              <span className="text-[13px] text-[#8E8E93] font-medium">•</span>
              <span className="text-[13px] text-[#8E8E93] font-medium">★ {(anime.averageScore / 10).toFixed(1)}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
