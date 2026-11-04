import type { Lang } from '@/core/store';

const STYLES: Record<Lang, string> = {
  // Blue for VF, pink (brand) for VOSTFR — never color alone: the label is always written.
  vf: 'bg-[#0A84FF]/20 text-[#64B5FF] border-[#0A84FF]/40',
  vostfr: 'bg-[#FF7AA8]/15 text-[#FF9EC0] border-[#FF7AA8]/40',
};

export function LangTag({ lang, className = '' }: { lang: Lang; className?: string }) {
  return (
    <span
      className={`inline-flex items-center px-1.5 py-[1px] rounded-md border text-[10px] font-bold tracking-wide uppercase leading-4 ${STYLES[lang]} ${className}`}
    >
      {lang === 'vf' ? 'VF' : 'VOSTFR'}
    </span>
  );
}
