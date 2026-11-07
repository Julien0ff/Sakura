/**
 * Horizontal card row that runs to the screen edges (cards stay aligned with the title at rest
 * thanks to scroll-padding). On desktop, cards scrolling under the floating sidebar get blurred.
 */
export function RowScroller({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      <div className="flex gap-4 overflow-x-auto pb-6 pt-2 px-6 md:pl-32 md:pr-10 scroll-px-6 md:scroll-pl-32 md:scroll-pr-10 snap-x snap-mandatory scrollbar-none">
        {children}
      </div>
      <div aria-hidden className="row-edge-blur hidden md:block" />
    </div>
  );
}
