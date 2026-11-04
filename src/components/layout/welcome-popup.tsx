'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

export function WelcomePopup() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Check if the user has already seen the popup
    const hasSeenWelcome = localStorage.getItem('hasSeenWelcome');
    if (!hasSeenWelcome) {
      // Small delay to make the animation feel natural
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    localStorage.setItem('hasSeenWelcome', 'true');
  };

  if (!isOpen) return null;

  return (
    <div role="dialog" aria-modal="true" aria-label="Bienvenue" className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="relative w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl border border-white/10 animate-in zoom-in-95 duration-300">
        
        {/* Blurred background image for color continuity */}
        <div className="absolute inset-0 z-0">
          <img 
            src="/banner.png" 
            alt="" 
            className="w-full h-full object-cover opacity-50 blur-3xl scale-110"
          />
          {/* Dark overlay so text remains readable */}
          <div className="absolute inset-0 bg-[#1C1C1E]/80" />
        </div>

        {/* Banner Image with CSS Mask for perfect smooth fade */}
        <div 
          className="w-full h-48 relative z-10"
          style={{ maskImage: 'linear-gradient(to bottom, black 50%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, black 50%, transparent 100%)' }}
        >
          <img 
            src="/banner.png" 
            alt="Bienvenue sur Anime Premium" 
            className="w-full h-full object-cover"
          />
        </div>

        {/* Close Button */}
        <button 
          onClick={handleClose}
          aria-label="Fermer"
          className="absolute top-4 right-4 p-2 rounded-full bg-black/40 hover:bg-[#FF6B9E]/80 text-white backdrop-blur-md transition-all duration-300 hover:rotate-90 hover:scale-110 cursor-pointer z-20"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Content */}
        <div className="relative p-8 text-center z-10">
          <h2 className="text-2xl font-bold text-white mb-4 tracking-tight">Bienvenue sur le projet !</h2>
          
          <div className="space-y-4 text-white/80 text-[15px] leading-relaxed">
            <p>
              Ceci est un projet open-source <strong className="text-white">publique</strong> développé avec passion, 
              destiné à offrir la meilleure expérience de visionnage d&apos;animés. 
            </p>
            <p>
              L&apos;interface a été conçue pour être fluide, moderne et sans publicité intrusive. 
              N&apos;hésitez pas à explorer les différentes fonctionnalités, découvrir de nouvelles séries 
              et profiter du mode plein écran !
            </p>
          </div>

          <button 
            onClick={handleClose}
            className="mt-8 w-full py-3.5 rounded-2xl bg-white text-black font-semibold text-[15px] hover:bg-[#FF6B9E] hover:text-white transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-[#FF6B9E]/40 cursor-pointer active:scale-[0.98]"
          >
            Commencer l&apos;exploration
          </button>
        </div>

      </div>
    </div>
  );
}
