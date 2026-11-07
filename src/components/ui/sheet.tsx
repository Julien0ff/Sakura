'use client';

import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react';

const EXIT_MS = 220;

/**
 * Modal sheet on a native <dialog> (top layer: always above the tab bar and sidebar,
 * focus trap and Escape for free). Bottom sheet on phones, centered card from md.
 * Mount it to open it; `close()` (passed to children) plays the exit animation, then calls onClose.
 */
export function Sheet({
  label,
  onClose,
  children,
  width = 'md',
}: {
  label: string;
  onClose: () => void;
  children: (close: () => void) => React.ReactNode;
  /** Desktop width: md ≈ 640px, lg ≈ 860px. */
  width?: 'md' | 'lg';
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  const finish = useEffectEvent(() => {
    ref.current?.close();
    onClose();
  });
  // Exit animation first, then unmount (via onClose).
  useEffect(() => {
    if (!closing) return;
    const t = setTimeout(finish, EXIT_MS);
    return () => clearTimeout(t);
  }, [closing]);

  const close = useCallback(() => setClosing(true), []);

  return (
    <dialog
      ref={ref}
      aria-label={label}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === ref.current) close(); // backdrop
      }}
      className={`sheet-dialog ${width === 'lg' ? 'sheet-lg' : ''} ${closing ? 'sheet-out' : ''}`}
    >
      <div className="sheet-body thin-scroll">{children(close)}</div>
    </dialog>
  );
}
