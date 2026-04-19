import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetDetection } from '../detect.js';
import { installVibrateShim, uninstallVibrateShim } from '../shims/vibrate.js';

function attachFakeNativeVibrate() {
  const vibrate = vi.fn((_pattern: VibratePattern) => true);
  Object.defineProperty(navigator, 'vibrate', {
    value: vibrate,
    configurable: true,
    writable: true,
  });
  return vibrate;
}

describe('installVibrateShim — browser mode', () => {
  beforeEach(() => {
    resetDetection();
    globalThis.__AIT_POLYFILL_FORCE__ = 'browser';
  });

  afterEach(() => {
    uninstallVibrateShim();
    resetDetection();
    globalThis.__AIT_POLYFILL_FORCE__ = undefined;
  });

  it('forwards to native vibrate', async () => {
    const native = attachFakeNativeVibrate();
    installVibrateShim();

    const result = (navigator as Navigator & { vibrate: (p: VibratePattern) => boolean }).vibrate(
      100,
    );

    expect(result).toBe(true);
    // Async microtask flush — shim dispatches via promise.
    await Promise.resolve();
    await Promise.resolve();
    expect(native).toHaveBeenCalledWith(100);
  });

  it('returns true for vibrate(0) without calling SDK/native', () => {
    attachFakeNativeVibrate();
    installVibrateShim();

    const result = (navigator as Navigator & { vibrate: (p: VibratePattern) => boolean }).vibrate(
      0,
    );

    expect(result).toBe(true);
  });
});

describe('installVibrateShim — Toss mode', () => {
  beforeEach(() => {
    resetDetection();
    globalThis.__AIT_POLYFILL_FORCE__ = 'toss';
  });

  afterEach(() => {
    uninstallVibrateShim();
    resetDetection();
    globalThis.__AIT_POLYFILL_FORCE__ = undefined;
    vi.resetModules();
  });

  it('maps short vibrations (< 40ms) to tickWeak', async () => {
    const generateHapticFeedback = vi.fn(async () => undefined);
    vi.doMock('@apps-in-toss/web-framework', () => ({
      getClipboardText: vi.fn(),
      generateHapticFeedback,
    }));

    attachFakeNativeVibrate();
    installVibrateShim();

    (navigator as Navigator & { vibrate: (p: VibratePattern) => boolean }).vibrate(20);
    // Let the async dispatch run.
    await new Promise((r) => setTimeout(r, 10));

    expect(generateHapticFeedback).toHaveBeenCalledWith({ type: 'tickWeak' });
  });

  it('maps long vibrations (≥ 40ms) to basicMedium', async () => {
    const generateHapticFeedback = vi.fn(async () => undefined);
    vi.doMock('@apps-in-toss/web-framework', () => ({
      getClipboardText: vi.fn(),
      generateHapticFeedback,
    }));

    attachFakeNativeVibrate();
    installVibrateShim();

    (navigator as Navigator & { vibrate: (p: VibratePattern) => boolean }).vibrate(200);
    await new Promise((r) => setTimeout(r, 10));

    expect(generateHapticFeedback).toHaveBeenCalledWith({ type: 'basicMedium' });
  });

  it('iterates pattern arrays as tap pulses', async () => {
    const generateHapticFeedback = vi.fn(async () => undefined);
    vi.doMock('@apps-in-toss/web-framework', () => ({
      getClipboardText: vi.fn(),
      generateHapticFeedback,
    }));

    attachFakeNativeVibrate();
    installVibrateShim();

    (navigator as Navigator & { vibrate: (p: VibratePattern) => boolean }).vibrate([50, 10, 50]);
    // Pauses between pulses happen via setTimeout; let them complete.
    await new Promise((r) => setTimeout(r, 50));

    expect(generateHapticFeedback).toHaveBeenCalledTimes(2);
    expect(generateHapticFeedback).toHaveBeenCalledWith({ type: 'tap' });
  });
});
