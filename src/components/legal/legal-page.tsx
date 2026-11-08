import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { legalLinks, siteConfig } from '@/lib/site-config';

interface LegalPageProps {
  title: string;
  current: string;
  children: React.ReactNode;
}

export function LegalPage({ title, current, children }: LegalPageProps) {
  return (
    <AppLayout>
      <div className="px-6 md:pl-32 md:pr-10 pt-10 pb-16 animate-in fade-in duration-500">
        <nav aria-label="Pages légales" className="flex gap-2 overflow-x-auto scrollbar-none mb-8 -mx-1 px-1">
          {legalLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={l.href === current ? 'page' : undefined}
              className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                l.href === current ? 'bg-white text-black border-white' : 'bg-white/5 text-white/80 border-white/10 hover:bg-white/10'
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <article className="legal-prose max-w-3xl">
          <h1 className="text-4xl md:text-5xl font-bold text-sakura mb-2" style={{ fontFamily: 'var(--font-impact)' }}>
            {title}
          </h1>
          <p className="text-sm text-[#8E8E93] mb-10">Dernière mise à jour : {siteConfig.updatedAt}</p>
          {children}
        </article>
      </div>
    </AppLayout>
  );
}
