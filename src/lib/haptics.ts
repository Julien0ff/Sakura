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

// The Vibration API has no amplitude control: perceived strength comes from duration only.
// Base durations (ms) for "Normale"; pauses between pulses are not scaled.
const PATTERNS: Record<HapticKind, number[]> = {
  selection: [35],
  light: [40],
  medium: [65],
  success: [50, 80, 75],
  warning: [70, 70, 70, 70, 70],
};

export type HapticIntensity = 'soft' | 'normal' | 'strong';
const SCALE: Record<HapticIntensity, number> = { soft: 0.6, normal: 1, strong: 1.7 };

let intensity: HapticIntensity = 'normal';
export function setHapticIntensity(value: HapticIntensity) {
  intensity = value;
}

/** Scales vibration segments (even indexes), keeps pauses (odd indexes) as-is. */
function scaled(pattern: number[], level: HapticIntensity = intensity) {
  return pattern.map((ms, i) => (i % 2 === 0 ? Math.round(ms * SCALE[level]) : ms));
}

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

export type HapticSupport = 'vibration' | 'ios-switch' | 'none';

/** What this device/browser can do — used by the Settings "Tester" button. */
export function hapticSupport(): HapticSupport {
  if (typeof window === 'undefined') return 'none';
  if (isIOS()) return 'ios-switch';
  if (typeof navigator.vibrate === 'function') return 'vibration';
  return 'none';
}

/**
 * Same as haptic() but reports the browser's answer. navigator.vibrate returns false when
 * the call is refused (no user gesture yet, blocked by the browser or the page settings).
 */
export function testHaptic(): { support: HapticSupport; accepted: boolean } {
  const support = hapticSupport();
  if (support === 'vibration') return { support, accepted: navigator.vibrate(scaled([60, 90, 60])) };
  if (support === 'ios-switch') {
    getIosSwitch().click();
    return { support, accepted: true };
  }
  return { support, accepted: false };
}

export function haptic(kind: HapticKind = 'selection') {
  if (!enabled || typeof window === 'undefined') return;
  try {
    if (typeof navigator.vibrate === 'function' && !isIOS()) {
      navigator.vibrate(scaled(PATTERNS[kind]));
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
