'use client';

/**
 * Cross-platform haptic feedback for the web.
 * - Android (Chrome, Firefox…): Vibration API with short patterns.
 * - iOS 18+ Safari: no Vibration API, but toggling a native `<input type="checkbox" switch>`
 *   plays the system "selection" haptic. We keep one hidden switch and click its label.
 * Both only work inside a user gesture (tap/click handler). Silently no-op elsewhere
 * (desktop, older iOS) and when the user turned haptics off in Settings.
 */
export type HapticKind = 'selection' | 'light' | 'medium' | 'success' | 'warning';

const PATTERNS: Record<HapticKind, number | number[]> = {
  selection: 8,
  light: 12,
  medium: 22,
  success: [14, 60, 22],
  warning: [24, 50, 24, 50, 24],
};

// iOS only plays one tick per toggle: repeat for "stronger" kinds.
const IOS_TICKS: Record<HapticKind, number[]> = {
  selection: [0],
  light: [0],
  medium: [0, 60],
  success: [0, 90],
  warning: [0, 70, 140],
};

let enabled = true;
export function setHapticsEnabled(value: boolean) {
  enabled = value;
}

let iosLabel: HTMLLabelElement | null = null;
function getIosSwitch() {
  if (iosLabel?.isConnected) return iosLabel;
  const label = document.createElement('label');
  label.setAttribute('aria-hidden', 'true');
  label.style.cssText = 'position:fixed;left:-9999px;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.setAttribute('switch', '');
  input.tabIndex = -1;
  label.appendChild(input);
  document.body.appendChild(label);
  iosLabel = label;
  return label;
}

const isIOS = () =>
  typeof navigator !== 'undefined' &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

export function haptic(kind: HapticKind = 'selection') {
  if (!enabled || typeof window === 'undefined') return;
  try {
    if (typeof navigator.vibrate === 'function' && !isIOS()) {
      navigator.vibrate(PATTERNS[kind]);
      return;
    }
    if (isIOS()) {
      const label = getIosSwitch();
      IOS_TICKS[kind].forEach((delay, i) => {
        // First tick must stay synchronous to keep the user-gesture context.
        if (i === 0) label.click();
        else setTimeout(() => label.click(), delay);
      });
    }
  } catch {
    /* haptics are best-effort */
  }
}
