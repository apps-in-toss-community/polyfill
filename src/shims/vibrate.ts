/**
 * `navigator.vibrate` shim.
 *
 * Inside Apps in Toss → best-effort mapping to SDK `generateHapticFeedback`:
 *   - `vibrate(0)` → no-op (web standard: cancels pending vibration)
 *   - `vibrate(number)`: short (< 40ms) → `tickWeak`, long (≥ 40ms) → `basicMedium`
 *   - `vibrate(number[])`: iterate "on" segments (even indices) as `tap` pulses
 *
 * Outside Apps in Toss → defers to the browser's native `navigator.vibrate`,
 * or returns `false` when unavailable (matches the spec — browsers that don't
 * support vibration simply return `false`).
 *
 * Caveats (documented in CLAUDE.md as the known lossy trade-off):
 *   - SDK haptics are qualitative ("tickWeak", "basicMedium"), not millisecond
 *     durations. The shim approximates intensity from duration but cannot
 *     reproduce exact patterns.
 *   - Arrays are fired sequentially via `setTimeout`; gaps between pulses are
 *     honoured only as "time until the next tap", not as silent-vs-vibrating.
 *   - `vibrate` is spec'd as **synchronous**; the SDK call is async. We return
 *     `true` immediately (fire-and-forget). Errors from the SDK are swallowed.
 */

import { isTossEnvironment, loadTossSdk } from '../detect.js';

const BACKUP_KEY = Symbol.for('@ait-co/polyfill/vibrate.original');

interface BackupHost {
  [BACKUP_KEY]?: ((pattern: VibratePattern) => boolean) | undefined;
}

const SHORT_VIBRATION_MS = 40;

type HapticType =
  | 'tickWeak'
  | 'tap'
  | 'tickMedium'
  | 'softMedium'
  | 'basicWeak'
  | 'basicMedium'
  | 'success'
  | 'error'
  | 'wiggle'
  | 'confetti';

async function haptic(type: HapticType): Promise<void> {
  const sdk = await loadTossSdk();
  const fn = (sdk as { generateHapticFeedback?: unknown } | null)?.generateHapticFeedback;
  if (typeof fn === 'function') {
    try {
      await (fn as (o: { type: HapticType }) => Promise<void>)({ type });
    } catch {
      // Best-effort; spec-level `vibrate` cannot surface errors.
    }
  }
}

function durationToHaptic(duration: number): HapticType {
  return duration < SHORT_VIBRATION_MS ? 'tickWeak' : 'basicMedium';
}

function vibrateShim(pattern: VibratePattern): boolean {
  // Matches the spec: `vibrate(0)` or `vibrate([])` cancels pending vibration.
  // We can't cancel an in-flight SDK haptic, but neither firing a new one is
  // the closest analogue.
  const arr = Array.isArray(pattern) ? pattern : [pattern];
  if (arr.length === 0 || arr.every((n) => n === 0)) {
    return true;
  }

  void (async () => {
    if (await isTossEnvironment()) {
      if (!Array.isArray(pattern)) {
        await haptic(durationToHaptic(pattern));
        return;
      }
      // Even indices = "on" durations, odd indices = pauses.
      for (let i = 0; i < pattern.length; i += 2) {
        const on = pattern[i];
        if (on === undefined) break;
        if (on > 0) {
          await haptic('tap');
        }
        const pause = pattern[i + 1];
        if (typeof pause === 'number' && pause > 0) {
          await new Promise<void>((r) => setTimeout(r, pause));
        }
      }
      return;
    }
    const host = navigator as unknown as BackupHost;
    const original = host[BACKUP_KEY];
    original?.call(navigator, pattern);
  })();

  return true;
}

export function installVibrateShim(): () => void {
  if (typeof navigator === 'undefined') {
    return () => {};
  }

  const host = navigator as unknown as BackupHost;
  if (BACKUP_KEY in host) {
    return () => uninstallVibrateShim();
  }

  const original = (navigator as Navigator & { vibrate?: (p: VibratePattern) => boolean }).vibrate;
  host[BACKUP_KEY] = original;

  Object.defineProperty(navigator, 'vibrate', {
    value: vibrateShim,
    configurable: true,
    writable: true,
  });

  return uninstallVibrateShim;
}

export function uninstallVibrateShim(): void {
  if (typeof navigator === 'undefined') return;
  const host = navigator as unknown as BackupHost;
  if (!(BACKUP_KEY in host)) return;

  const original = host[BACKUP_KEY];
  Object.defineProperty(navigator, 'vibrate', {
    value: original,
    configurable: true,
    writable: true,
  });
  delete host[BACKUP_KEY];
}
