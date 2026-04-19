/**
 * `navigator.geolocation` shim.
 *
 * Inside Apps in Toss → routes through the SDK:
 *   - `getCurrentPosition` → `getCurrentLocation({ accuracy })`
 *   - `watchPosition` / `clearWatch` → `startUpdateLocation({ onEvent, onError, options })`
 *
 * Outside Apps in Toss → defers to the browser's native `navigator.geolocation`.
 * If neither is available, the error callback receives a `GeolocationPositionError`.
 *
 * SDK/Web shape mismatch handled here:
 *   - SDK `Accuracy` is a numeric enum (1 = Lowest … 6 = BestForNavigation); the
 *     standard `PositionOptions.enableHighAccuracy` is a boolean. We map
 *     `true → Accuracy.High (4, "~10m")` and `false → Accuracy.Balanced (3)`.
 *     `Highest (5)` / `BestForNavigation (6)` are available but carry a battery
 *     cost that's rarely what mini-apps want; consumers who need them should
 *     call the SDK directly.
 *   - SDK coords lack `speed`; we surface `null` (per the W3C spec when unknown).
 *   - SDK `startUpdateLocation` returns an `unsubscribe` fn; we wrap it behind
 *     a numeric watch id so `clearWatch(id)` behaves like the standard.
 *
 * Caveat: watch ids reset whenever the shim is uninstalled and reinstalled;
 * they are not stable across such cycles. Ids obtained before uninstall
 * cannot be cleared after uninstall — `clearWatch(id)` on the restored native
 * `navigator.geolocation` uses a different id space, so the SDK subscription
 * leaks. Consumers should `clearWatch` all outstanding ids before calling
 * `uninstall()`.
 */

import { isTossEnvironment, loadTossSdk } from '../detect.js';
import {
  type InstallSnapshot,
  installNavigatorProperty,
  restoreNavigatorProperty,
} from './_install-helpers.js';

const BACKUP_KEY = Symbol.for('@ait-co/polyfill/geolocation.original');
const SNAPSHOT_KEY = Symbol.for('@ait-co/polyfill/geolocation.snapshot');

interface BackupHost {
  [BACKUP_KEY]?: Geolocation | undefined;
  [SNAPSHOT_KEY]?: InstallSnapshot | undefined;
}

// SDK Accuracy enum values. We don't import the enum at runtime (peer is
// optional), so we hard-code the numeric constants used by the SDK. Stable
// ABI per the SDK's exported numeric enum.
const ACCURACY_BALANCED = 3;
const ACCURACY_HIGH = 4;

interface SdkLocationCoords {
  latitude: number;
  longitude: number;
  altitude: number;
  accuracy: number;
  altitudeAccuracy: number;
  heading: number;
}

interface SdkLocation {
  timestamp: number;
  coords: SdkLocationCoords;
}

function toStandardPosition(sdk: SdkLocation): GeolocationPosition {
  const coordsData = {
    latitude: sdk.coords.latitude,
    longitude: sdk.coords.longitude,
    altitude: sdk.coords.altitude,
    accuracy: sdk.coords.accuracy,
    altitudeAccuracy: sdk.coords.altitudeAccuracy,
    heading: sdk.coords.heading,
    // SDK does not surface speed. Per spec, null means "unknown".
    speed: null,
  };
  const coords: GeolocationCoordinates = {
    ...coordsData,
    toJSON() {
      return { ...coordsData };
    },
  };
  return {
    coords,
    timestamp: sdk.timestamp,
    toJSON() {
      return { coords: { ...coordsData }, timestamp: sdk.timestamp };
    },
  };
}

function toPositionError(code: 1 | 2 | 3, message: string): GeolocationPositionError {
  // Prefer the real constructor when available (every real browser ships it).
  // The spec says GeolocationPositionError is not constructable, so we fall
  // through to a fabricated object whose prototype is patched via
  // `setPrototypeOf` — that keeps `instanceof` checks in consumer code working
  // and picks up the spec's PERMISSION_DENIED / POSITION_UNAVAILABLE / TIMEOUT
  // constants from the real prototype rather than hard-coding them (avoids
  // drift if the spec ever grows a new code).
  const Ctor = (globalThis as { GeolocationPositionError?: unknown }).GeolocationPositionError;
  if (typeof Ctor === 'function') {
    const proto = (Ctor as { prototype?: object }).prototype;
    if (proto) {
      const shape: { code: number; message: string } = { code, message };
      Object.setPrototypeOf(shape, proto);
      return shape as GeolocationPositionError;
    }
  }
  // jsdom / last-resort fallback: fabricate the spec shape with hard-coded
  // constants since there's no prototype to delegate to.
  return {
    code,
    message,
    PERMISSION_DENIED: 1,
    POSITION_UNAVAILABLE: 2,
    TIMEOUT: 3,
  } as GeolocationPositionError;
}

function accuracyFromOptions(options: PositionOptions | undefined): number {
  return options?.enableHighAccuracy ? ACCURACY_HIGH : ACCURACY_BALANCED;
}

function createGeolocationShim(fallback: Geolocation | undefined): Geolocation {
  // Numeric watch id → SDK unsubscribe fn. Keeps the shim's API in line with
  // the standard even though the SDK issues unsubscribe closures instead.
  // `pendingWatches` closes the race where `clearWatch` is called before the
  // async `watchPosition` installer resolves — without it we'd leak the SDK
  // subscription.
  let nextWatchId = 1;
  const sdkWatches = new Map<number, () => void>();
  const nativeWatches = new Map<number, number>();
  const pendingWatches = new Map<number, { cancelled: boolean }>();

  const shim: Geolocation = {
    getCurrentPosition(success, error, options) {
      void (async () => {
        if (await isTossEnvironment()) {
          const sdk = await loadTossSdk();
          const fn = (sdk as { getCurrentLocation?: unknown } | null)?.getCurrentLocation;
          if (typeof fn === 'function') {
            try {
              const loc = (await (fn as (o: { accuracy: number }) => Promise<SdkLocation>)({
                accuracy: accuracyFromOptions(options),
              })) as SdkLocation;
              success(toStandardPosition(loc));
            } catch (e) {
              error?.(
                toPositionError(
                  2,
                  e instanceof Error ? e.message : '[@ait-co/polyfill] getCurrentLocation failed.',
                ),
              );
            }
            return;
          }
        }
        if (!fallback) {
          error?.(
            toPositionError(
              2,
              '[@ait-co/polyfill] navigator.geolocation is not available in this environment.',
            ),
          );
          return;
        }
        fallback.getCurrentPosition(success, error, options);
      })();
    },

    watchPosition(success, error, options) {
      const id = nextWatchId++;
      const pending = { cancelled: false };
      pendingWatches.set(id, pending);

      void (async () => {
        if (await isTossEnvironment()) {
          const sdk = await loadTossSdk();
          const fn = (sdk as { startUpdateLocation?: unknown } | null)?.startUpdateLocation;
          if (typeof fn === 'function') {
            if (pending.cancelled) {
              pendingWatches.delete(id);
              return;
            }
            const unsubscribe = (
              fn as (p: {
                onEvent: (loc: SdkLocation) => void;
                onError: (err: unknown) => void;
                options: { accuracy: number; timeInterval: number; distanceInterval: number };
              }) => () => void
            )({
              onEvent: (loc) => success(toStandardPosition(loc)),
              onError: (err) =>
                error?.(
                  toPositionError(
                    2,
                    err instanceof Error
                      ? err.message
                      : '[@ait-co/polyfill] startUpdateLocation failed.',
                  ),
                ),
              options: {
                accuracy: accuracyFromOptions(options),
                // Sensible defaults — web `watchPosition` has no analogues.
                // Consumers needing sub-second updates should use the SDK directly.
                timeInterval: 1000,
                distanceInterval: 0,
              },
            });
            if (pending.cancelled) {
              unsubscribe();
              pendingWatches.delete(id);
              return;
            }
            sdkWatches.set(id, unsubscribe);
            pendingWatches.delete(id);
            return;
          }
        }
        if (!fallback) {
          pendingWatches.delete(id);
          error?.(
            toPositionError(
              2,
              '[@ait-co/polyfill] navigator.geolocation is not available in this environment.',
            ),
          );
          return;
        }
        if (pending.cancelled) {
          pendingWatches.delete(id);
          return;
        }
        const nativeId = fallback.watchPosition(success, error, options);
        if (pending.cancelled) {
          fallback.clearWatch(nativeId);
          pendingWatches.delete(id);
          return;
        }
        nativeWatches.set(id, nativeId);
        pendingWatches.delete(id);
      })();

      return id;
    },

    clearWatch(id) {
      const pending = pendingWatches.get(id);
      if (pending) {
        pending.cancelled = true;
        pendingWatches.delete(id);
        return;
      }
      const unsubscribe = sdkWatches.get(id);
      if (unsubscribe) {
        unsubscribe();
        sdkWatches.delete(id);
        return;
      }
      const nativeId = nativeWatches.get(id);
      if (nativeId !== undefined && fallback) {
        fallback.clearWatch(nativeId);
        nativeWatches.delete(id);
      }
    },
  };

  return shim;
}

export function installGeolocationShim(): () => void {
  if (typeof navigator === 'undefined') {
    return () => {};
  }

  const host = navigator as unknown as BackupHost;
  if (BACKUP_KEY in host) {
    return () => uninstallGeolocationShim();
  }

  const original = navigator.geolocation as Geolocation | undefined;
  host[BACKUP_KEY] = original;

  const shim = createGeolocationShim(original);
  host[SNAPSHOT_KEY] = installNavigatorProperty('geolocation', {
    value: shim,
    configurable: true,
    writable: true,
  });

  return uninstallGeolocationShim;
}

export function uninstallGeolocationShim(): void {
  if (typeof navigator === 'undefined') return;
  const host = navigator as unknown as BackupHost;
  if (!(BACKUP_KEY in host)) return;

  const snapshot = host[SNAPSHOT_KEY];
  if (snapshot) restoreNavigatorProperty('geolocation', snapshot);
  delete host[BACKUP_KEY];
  delete host[SNAPSHOT_KEY];
}
