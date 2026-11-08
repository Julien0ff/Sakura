'use client';

import { useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const noop = () => () => {};

/**
 * Renders into <body>, outside <main> (whose z-[1] stacking context keeps page content under the
 * mobile status-bar blur): for floating buttons that must stay above it, like the account button.
 */
export function Portal({ children }: { children: ReactNode }) {
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  return mounted ? createPortal(children, document.body) : null;
}
