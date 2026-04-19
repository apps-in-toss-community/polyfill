import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetDetection } from '../detect.js';
import { installNetworkShim, uninstallNetworkShim } from '../shims/network.js';

describe('installNetworkShim — browser mode', () => {
  beforeEach(() => {
    resetDetection();
    globalThis.__AIT_POLYFILL_FORCE__ = 'browser';
  });

  afterEach(() => {
    uninstallNetworkShim();
    resetDetection();
    globalThis.__AIT_POLYFILL_FORCE__ = undefined;
  });

  it('falls back to a truthy onLine when SDK is absent', () => {
    installNetworkShim();
    // jsdom defaults onLine to true; the shim respects that when cache empty.
    expect(navigator.onLine).toBe(true);
  });

  it('restores original descriptors on uninstall', () => {
    installNetworkShim();
    uninstallNetworkShim();
    // After uninstall, onLine should still be accessible (native descriptor restored).
    expect(typeof navigator.onLine).toBe('boolean');
  });
});

describe('installNetworkShim — Toss mode', () => {
  beforeEach(() => {
    resetDetection();
    globalThis.__AIT_POLYFILL_FORCE__ = 'toss';
  });

  afterEach(() => {
    uninstallNetworkShim();
    resetDetection();
    globalThis.__AIT_POLYFILL_FORCE__ = undefined;
    vi.resetModules();
  });

  it('maps WIFI to onLine=true, effectiveType=4g, type=wifi', async () => {
    const getNetworkStatus = vi.fn(async () => 'WIFI');
    vi.doMock('@apps-in-toss/web-framework', () => ({
      getClipboardText: vi.fn(),
      getNetworkStatus,
    }));

    installNetworkShim();
    // Let the install-time refresh settle.
    await new Promise((r) => setTimeout(r, 10));

    expect(navigator.onLine).toBe(true);
    const connection = (
      navigator as Navigator & { connection?: { effectiveType: string; type: string } }
    ).connection;
    expect(connection?.effectiveType).toBe('4g');
    expect(connection?.type).toBe('wifi');
  });

  it('maps OFFLINE to onLine=false', async () => {
    const getNetworkStatus = vi.fn(async () => 'OFFLINE');
    vi.doMock('@apps-in-toss/web-framework', () => ({
      getClipboardText: vi.fn(),
      getNetworkStatus,
    }));

    installNetworkShim();
    await new Promise((r) => setTimeout(r, 10));

    expect(navigator.onLine).toBe(false);
  });

  it('maps 3G to effectiveType=3g', async () => {
    const getNetworkStatus = vi.fn(async () => '3G');
    vi.doMock('@apps-in-toss/web-framework', () => ({
      getClipboardText: vi.fn(),
      getNetworkStatus,
    }));

    installNetworkShim();
    await new Promise((r) => setTimeout(r, 10));

    const connection = (navigator as Navigator & { connection?: { effectiveType: string } })
      .connection;
    expect(connection?.effectiveType).toBe('3g');
  });
});
