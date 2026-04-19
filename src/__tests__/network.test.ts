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
    expect(navigator.onLine).toBe(true);
  });

  it('restores original descriptors on uninstall', () => {
    installNetworkShim();
    uninstallNetworkShim();
    // After uninstall, onLine should still be accessible (native descriptor restored).
    expect(typeof navigator.onLine).toBe('boolean');
  });

  it('uninstall removes instance-level overrides so the prototype getter shows through', () => {
    installNetworkShim();
    // While installed, `onLine` is an own getter on navigator.
    expect(Object.getOwnPropertyDescriptor(navigator, 'onLine')).toBeDefined();

    uninstallNetworkShim();
    // After uninstall, the own property is gone; prototype getter (jsdom's)
    // takes over.
    expect(Object.getOwnPropertyDescriptor(navigator, 'onLine')).toBeUndefined();
  });

  it('navigator.connection falls through to the native value when cache is unseeded', () => {
    // Simulate a real browser that exposes `navigator.connection` on the
    // prototype. The shim must not shadow it with its own default in
    // browser mode.
    const proto = Object.getPrototypeOf(navigator) as object;
    const origDesc = Object.getOwnPropertyDescriptor(proto, 'connection');
    const fakeNative = { effectiveType: '3g', type: 'cellular' };
    Object.defineProperty(proto, 'connection', { configurable: true, get: () => fakeNative });

    try {
      installNetworkShim();
      const connection = (navigator as Navigator & { connection?: unknown }).connection;
      expect(connection).toBe(fakeNative);
    } finally {
      uninstallNetworkShim();
      if (origDesc) Object.defineProperty(proto, 'connection', origDesc);
      else delete (proto as { connection?: unknown }).connection;
    }
  });

  it('does not throw when the prototype `onLine` descriptor is non-configurable (simulated real-browser shape)', () => {
    // In real browsers the prototype `onLine` descriptor may be
    // non-configurable. Verify that install/uninstall never tries to mutate
    // the prototype (it would throw otherwise).
    const proto = Object.getPrototypeOf(navigator) as object;
    const beforeDesc = Object.getOwnPropertyDescriptor(proto, 'onLine');

    expect(() => {
      const off = installNetworkShim();
      off();
    }).not.toThrow();

    const afterDesc = Object.getOwnPropertyDescriptor(proto, 'onLine');
    expect(afterDesc).toEqual(beforeDesc);
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
    await vi.waitFor(() => expect(getNetworkStatus).toHaveBeenCalled());

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
    await vi.waitFor(() => expect(navigator.onLine).toBe(false));
  });

  it('maps 3G to effectiveType=3g', async () => {
    const getNetworkStatus = vi.fn(async () => '3G');
    vi.doMock('@apps-in-toss/web-framework', () => ({
      getClipboardText: vi.fn(),
      getNetworkStatus,
    }));

    installNetworkShim();
    await vi.waitFor(() => {
      const connection = (navigator as Navigator & { connection?: { effectiveType: string } })
        .connection;
      expect(connection?.effectiveType).toBe('3g');
    });
  });

  it('returns a stable `connection` reference across reads so EventTarget listeners stick', async () => {
    const getNetworkStatus = vi.fn(async () => 'WIFI');
    vi.doMock('@apps-in-toss/web-framework', () => ({
      getClipboardText: vi.fn(),
      getNetworkStatus,
    }));

    installNetworkShim();
    const a = (navigator as Navigator & { connection?: EventTarget }).connection;
    const b = (navigator as Navigator & { connection?: EventTarget }).connection;
    expect(a).toBe(b);

    const listener = vi.fn();
    a?.addEventListener('change', listener);
    a?.dispatchEvent(new Event('change'));
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('connection object supports addEventListener (NetworkInformation is an EventTarget)', () => {
    installNetworkShim();
    const connection = (navigator as Navigator & { connection?: { addEventListener?: unknown } })
      .connection;
    expect(typeof connection?.addEventListener).toBe('function');
  });

  it('does not dispatch a spurious `change` event from the initial seed', async () => {
    vi.resetModules();
    const getNetworkStatus = vi.fn(async () => 'WIFI' as const);
    vi.doMock('@apps-in-toss/web-framework', () => ({
      getClipboardText: vi.fn(),
      getNetworkStatus,
    }));

    installNetworkShim();
    const listener = vi.fn();
    const connection = (navigator as Navigator & { connection?: EventTarget }).connection;
    connection?.addEventListener('change', listener);

    // Wait for the seed refresh to resolve, then assert we saw no change
    // event (null → X is learning, not a transition).
    await vi.waitFor(() => expect(navigator.onLine).toBe(true));
    await new Promise((r) => setTimeout(r, 50));
    expect(listener).not.toHaveBeenCalled();
  });
});
