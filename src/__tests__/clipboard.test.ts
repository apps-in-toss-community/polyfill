import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetDetection } from '../detect.js';
import { installClipboardShim, uninstallClipboardShim } from '../shims/clipboard.js';

// Provide a minimal browser-native Clipboard mock on jsdom's navigator for
// fallback-path tests. jsdom's built-in navigator.clipboard is async but we
// want to observe call args.
function attachFakeNativeClipboard() {
  const readText = vi.fn(async () => 'native-read');
  const writeText = vi.fn(async (_text: string) => undefined);
  const fake = {
    readText,
    writeText,
    read: vi.fn(),
    write: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(() => true),
  };
  Object.defineProperty(navigator, 'clipboard', {
    value: fake,
    configurable: true,
    writable: true,
  });
  return fake;
}

describe('installClipboardShim — browser mode (Toss not detected)', () => {
  beforeEach(() => {
    resetDetection();
    globalThis.__AIT_POLYFILL_FORCE__ = 'browser';
  });

  afterEach(() => {
    uninstallClipboardShim();
    resetDetection();
    globalThis.__AIT_POLYFILL_FORCE__ = undefined;
  });

  it('forwards readText to the native clipboard', async () => {
    const native = attachFakeNativeClipboard();
    installClipboardShim();

    const result = await navigator.clipboard.readText();

    expect(result).toBe('native-read');
    expect(native.readText).toHaveBeenCalledTimes(1);
  });

  it('forwards writeText to the native clipboard', async () => {
    const native = attachFakeNativeClipboard();
    installClipboardShim();

    await navigator.clipboard.writeText('hi');

    expect(native.writeText).toHaveBeenCalledWith('hi');
  });

  it('restores the original clipboard on uninstall', async () => {
    const native = attachFakeNativeClipboard();
    installClipboardShim();
    uninstallClipboardShim();

    expect(navigator.clipboard).toBe(native);
  });

  it('is idempotent — double install does not double-wrap', async () => {
    attachFakeNativeClipboard();
    const first = installClipboardShim();
    const shimA = navigator.clipboard;
    const second = installClipboardShim();
    const shimB = navigator.clipboard;

    expect(shimA).toBe(shimB);

    first();
    second(); // should be a no-op since first already restored
    // navigator.clipboard should now be the original fake.
    expect(typeof navigator.clipboard.readText).toBe('function');
  });
});

describe('installClipboardShim — Toss mode', () => {
  beforeEach(() => {
    resetDetection();
    globalThis.__AIT_POLYFILL_FORCE__ = 'toss';
  });

  afterEach(() => {
    uninstallClipboardShim();
    resetDetection();
    globalThis.__AIT_POLYFILL_FORCE__ = undefined;
    vi.resetModules();
  });

  it('routes readText through the SDK', async () => {
    const getClipboardText = vi.fn(async () => 'sdk-text');
    vi.doMock('@apps-in-toss/web-framework', () => ({
      getClipboardText,
      setClipboardText: vi.fn(),
    }));

    // Re-import so the shim module gets fresh references via dynamic import in detect.ts.
    // (No re-import actually needed — loadTossSdk uses dynamic import at call time.)

    attachFakeNativeClipboard();
    installClipboardShim();
    const result = await navigator.clipboard.readText();

    expect(result).toBe('sdk-text');
    expect(getClipboardText).toHaveBeenCalledTimes(1);
  });

  it('routes writeText through the SDK', async () => {
    const setClipboardText = vi.fn(async (_text: string) => undefined);
    vi.doMock('@apps-in-toss/web-framework', () => ({
      getClipboardText: vi.fn(),
      setClipboardText,
    }));

    attachFakeNativeClipboard();
    installClipboardShim();
    await navigator.clipboard.writeText('from-polyfill');

    expect(setClipboardText).toHaveBeenCalledWith('from-polyfill');
  });

  it('throws on clipboard.read (rich content) because SDK has no counterpart', async () => {
    vi.doMock('@apps-in-toss/web-framework', () => ({
      getClipboardText: vi.fn(),
      setClipboardText: vi.fn(),
    }));

    attachFakeNativeClipboard();
    installClipboardShim();

    await expect(navigator.clipboard.read()).rejects.toThrow(/not supported/);
  });
});
