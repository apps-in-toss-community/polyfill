import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isTossEnvironment, resetDetection } from '../detect.js';

describe('detect / isTossEnvironment', () => {
  beforeEach(() => {
    resetDetection();
    globalThis.__AIT_POLYFILL_FORCE__ = undefined;
  });

  afterEach(() => {
    vi.resetModules();
    resetDetection();
    globalThis.__AIT_POLYFILL_FORCE__ = undefined;
  });

  it('honours the "toss" override', async () => {
    globalThis.__AIT_POLYFILL_FORCE__ = 'toss';
    expect(await isTossEnvironment()).toBe(true);
  });

  it('honours the "browser" override', async () => {
    globalThis.__AIT_POLYFILL_FORCE__ = 'browser';
    expect(await isTossEnvironment()).toBe(false);
  });

  it('caches the result after the first call', async () => {
    globalThis.__AIT_POLYFILL_FORCE__ = 'toss';
    expect(await isTossEnvironment()).toBe(true);

    // Flip the override; cached value wins.
    globalThis.__AIT_POLYFILL_FORCE__ = 'browser';
    expect(await isTossEnvironment()).toBe(true);

    resetDetection();
    expect(await isTossEnvironment()).toBe(false);
  });

  it('returns true when the SDK is resolvable and exports getClipboardText', async () => {
    // The devDep-installed @apps-in-toss/web-framework fulfils this in CI.
    // We intentionally don't mock here — it's the real resolution path.
    const result = await isTossEnvironment();
    // It should be true in this repo because the peer is installed as devDep.
    expect(result).toBe(true);
  });
});
