import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetDetection } from '../detect.js';
import { installGeolocationShim, uninstallGeolocationShim } from '../shims/geolocation.js';

function attachFakeNativeGeolocation() {
  const getCurrentPosition = vi.fn((success: PositionCallback) => {
    success({
      coords: {
        latitude: 10,
        longitude: 20,
        altitude: null,
        accuracy: 5,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
        toJSON: () => ({}),
      },
      timestamp: 999,
      toJSON: () => ({}),
    });
  });
  const watchPosition = vi.fn(() => 42);
  const clearWatch = vi.fn();
  const fake = { getCurrentPosition, watchPosition, clearWatch } as unknown as Geolocation;
  Object.defineProperty(navigator, 'geolocation', {
    value: fake,
    configurable: true,
    writable: true,
  });
  return fake as Geolocation & {
    getCurrentPosition: typeof getCurrentPosition;
    watchPosition: typeof watchPosition;
    clearWatch: typeof clearWatch;
  };
}

describe('installGeolocationShim — browser mode', () => {
  beforeEach(() => {
    resetDetection();
    globalThis.__AIT_POLYFILL_FORCE__ = 'browser';
  });

  afterEach(() => {
    uninstallGeolocationShim();
    resetDetection();
    globalThis.__AIT_POLYFILL_FORCE__ = undefined;
  });

  it('forwards getCurrentPosition to the native implementation', async () => {
    const native = attachFakeNativeGeolocation();
    installGeolocationShim();

    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject);
    });

    expect(position.coords.latitude).toBe(10);
    expect(native.getCurrentPosition).toHaveBeenCalledTimes(1);
  });

  it('forwards watchPosition/clearWatch to the native implementation', async () => {
    const native = attachFakeNativeGeolocation();
    installGeolocationShim();

    const id = navigator.geolocation.watchPosition(() => {});
    // watchPosition is async internally; yield to let it settle.
    await Promise.resolve();
    await Promise.resolve();
    expect(native.watchPosition).toHaveBeenCalledTimes(1);

    navigator.geolocation.clearWatch(id);
    expect(native.clearWatch).toHaveBeenCalledWith(42);
  });

  it('restores original geolocation on uninstall', () => {
    const native = attachFakeNativeGeolocation();
    installGeolocationShim();
    uninstallGeolocationShim();
    expect(navigator.geolocation).toBe(native);
  });
});

describe('installGeolocationShim — Toss mode', () => {
  beforeEach(() => {
    resetDetection();
    globalThis.__AIT_POLYFILL_FORCE__ = 'toss';
  });

  afterEach(() => {
    uninstallGeolocationShim();
    resetDetection();
    globalThis.__AIT_POLYFILL_FORCE__ = undefined;
    vi.resetModules();
  });

  it('routes getCurrentPosition through SDK getCurrentLocation, converting to standard shape', async () => {
    const getCurrentLocation = vi.fn(async (_opts: { accuracy: number }) => ({
      timestamp: 1234,
      coords: {
        latitude: 37.5,
        longitude: 127.0,
        altitude: 50,
        accuracy: 3,
        altitudeAccuracy: 1,
        heading: 90,
      },
    }));
    vi.doMock('@apps-in-toss/web-framework', () => ({
      getClipboardText: vi.fn(),
      getCurrentLocation,
    }));

    attachFakeNativeGeolocation();
    installGeolocationShim();

    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true });
    });

    expect(getCurrentLocation).toHaveBeenCalledWith({ accuracy: 4 });
    expect(position.timestamp).toBe(1234);
    expect(position.coords.latitude).toBe(37.5);
    expect(position.coords.speed).toBeNull();
  });

  it('maps enableHighAccuracy:false to SDK Accuracy.Balanced', async () => {
    const getCurrentLocation = vi.fn(async (_opts: { accuracy: number }) => ({
      timestamp: 0,
      coords: {
        latitude: 0,
        longitude: 0,
        altitude: 0,
        accuracy: 0,
        altitudeAccuracy: 0,
        heading: 0,
      },
    }));
    vi.doMock('@apps-in-toss/web-framework', () => ({
      getClipboardText: vi.fn(),
      getCurrentLocation,
    }));

    attachFakeNativeGeolocation();
    installGeolocationShim();

    await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject);
    });

    expect(getCurrentLocation).toHaveBeenCalledWith({ accuracy: 3 });
  });

  it('wraps SDK startUpdateLocation unsubscribe behind a numeric watch id', async () => {
    const unsubscribe = vi.fn();
    const startUpdateLocation = vi.fn(() => unsubscribe);
    vi.doMock('@apps-in-toss/web-framework', () => ({
      getClipboardText: vi.fn(),
      startUpdateLocation,
    }));

    attachFakeNativeGeolocation();
    installGeolocationShim();

    const id = navigator.geolocation.watchPosition(() => {});
    expect(typeof id).toBe('number');

    // Let the async watch install (SDK load + isTossEnvironment + subscribe).
    await new Promise((r) => setTimeout(r, 20));
    expect(startUpdateLocation).toHaveBeenCalledTimes(1);

    navigator.geolocation.clearWatch(id);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
