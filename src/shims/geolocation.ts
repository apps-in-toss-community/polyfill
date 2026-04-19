/**
 * `navigator.geolocation` shim.
 *
 * Inside Apps in Toss → routes through the SDK:
 *   - `getCurrentPosition` → `getCurrentLocation({ accuracy })`
 *   - `watchPosition` / `clearWatch` → `startUpdateLocation({ onEvent, onError, options })`
 *
 * Outside Apps in Toss → defers to the browser's native `navigator.geolocation`.
 * If neither is available, the callbacks receive a standard `GeolocationPositionError`.
 *
 * SDK/Web shape mismatch handled here:
 *   - SDK `Accuracy` is a numeric enum (1 = Lowest … 6 = BestForNavigation); the
 *     standard `PositionOptions.enableHighAccuracy` is a boolean. We map
 *     `true → Accuracy.High (4)` and `false → Accuracy.Balanced (3)`.
 *   - SDK coords lack `speed`; we surface `null` (per the W3C spec when unknown).
 *   - SDK `startUpdateLocation` returns an `unsubscribe` fn; we wrap it behind
 *     a numeric watch id so `clearWatch(id)` behaves like the standard.
 */

import { isTossEnvironment, loadTossSdk } from '../detect.js';

const BACKUP_KEY = Symbol.for('@ait-co/polyfill/geolocation.original');

interface BackupHost {
  [BACKUP_KEY]?: Geolocation | undefined;
}

// SDK Accuracy enum values. We don't import the enum at runtime (peer is
// optional), so we hard-code the numeric constants used by the SDK.
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
  const coords: GeolocationCoordinates = {
    latitude: sdk.coords.latitude,
    longitude: sdk.coords.longitude,
    altitude: sdk.coords.altitude,
    accuracy: sdk.coords.accuracy,
    altitudeAccuracy: sdk.coords.altitudeAccuracy,
    heading: sdk.coords.heading,
    // SDK does not surface speed. Per spec, null means "unknown".
    speed: null,
    toJSON() {
      return { ...this, toJSON: undefined };
    },
  };
  return {
    coords,
    timestamp: sdk.timestamp,
    toJSON() {
      return { coords: coords.toJSON(), timestamp: sdk.timestamp };
    },
  };
}

function toPositionError(code: 1 | 2 | 3, message: string): GeolocationPositionError {
  // jsdom does not expose GeolocationPositionError as a constructor; fabricate
  // an object that matches the spec shape so handlers can inspect `.code`.
  const err = {
    code,
    message,
    PERMISSION_DENIED: 1 as const,
    POSITION_UNAVAILABLE: 2 as const,
    TIMEOUT: 3 as const,
  };
  return err as GeolocationPositionError;
}

function accuracyFromOptions(options: PositionOptions | undefined): number {
  return options?.enableHighAccuracy ? ACCURACY_HIGH : ACCURACY_BALANCED;
}

function createGeolocationShim(fallback: Geolocation | undefined): Geolocation {
  // Numeric watch id → SDK unsubscribe fn. Keeps the shim's API in line with
  // the standard even though the SDK issues unsubscribe closures instead.
  let nextWatchId = 1;
  const sdkWatches = new Map<number, () => void>();
  const nativeWatches = new Map<number, number>();

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
        if (options === undefined) {
          fallback.getCurrentPosition(success, error ?? undefined);
        } else {
          fallback.getCurrentPosition(success, error ?? undefined, options);
        }
      })();
    },

    watchPosition(success, error, options) {
      const id = nextWatchId++;

      void (async () => {
        if (await isTossEnvironment()) {
          const sdk = await loadTossSdk();
          const fn = (sdk as { startUpdateLocation?: unknown } | null)?.startUpdateLocation;
          if (typeof fn === 'function') {
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
                // Sensible defaults — the Web `watchPosition` has no analogues.
                timeInterval: 1000,
                distanceInterval: 0,
              },
            });
            sdkWatches.set(id, unsubscribe);
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
        const nativeId =
          options === undefined
            ? fallback.watchPosition(success, error ?? undefined)
            : fallback.watchPosition(success, error ?? undefined, options);
        nativeWatches.set(id, nativeId);
      })();

      return id;
    },

    clearWatch(id) {
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
  Object.defineProperty(navigator, 'geolocation', {
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

  const original = host[BACKUP_KEY];
  Object.defineProperty(navigator, 'geolocation', {
    value: original,
    configurable: true,
    writable: true,
  });
  delete host[BACKUP_KEY];
}
