/**
 * `navigator.onLine` + `navigator.connection` shim.
 *
 * Inside Apps in Toss → seeded from SDK `getNetworkStatus()` on install and
 * refreshed on each read:
 *   - `'OFFLINE'`   → `onLine = false`
 *   - `'WIFI'`      → `onLine = true`, `effectiveType = '4g'` (no web wifi value)
 *   - `'2G'/'3G'/'4G'/'5G'` → `onLine = true`, `effectiveType = <lowercased>`
 *   - `'WWAN'/'UNKNOWN'`    → `onLine = true`, `effectiveType = '4g'` (best guess)
 *
 * Outside Apps in Toss → leaves the native `navigator.onLine` /
 * `navigator.connection` in place.
 *
 * Caveat: the Web NetworkInformation API is evented (`change` fires on
 * transitions). The SDK exposes only a one-shot query, so our shim polls
 * lazily on property read; we do **not** synthesize `change` events.
 */

import { isTossEnvironment, loadTossSdk } from '../detect.js';

const ONLINE_BACKUP_KEY = Symbol.for('@ait-co/polyfill/onLine.original');
const CONNECTION_BACKUP_KEY = Symbol.for('@ait-co/polyfill/connection.original');
const INSTALLED_KEY = Symbol.for('@ait-co/polyfill/network.installed');

interface BackupHost {
  [ONLINE_BACKUP_KEY]?: PropertyDescriptor | undefined;
  [CONNECTION_BACKUP_KEY]?: PropertyDescriptor | undefined;
  [INSTALLED_KEY]?: boolean;
}

type SdkNetworkStatus = 'OFFLINE' | 'WIFI' | '2G' | '3G' | '4G' | '5G' | 'WWAN' | 'UNKNOWN';
type EffectiveType = 'slow-2g' | '2g' | '3g' | '4g';

interface ConnectionLike {
  readonly effectiveType: EffectiveType;
  readonly downlink: number;
  readonly rtt: number;
  readonly saveData: boolean;
  readonly type: string;
}

// Cached so synchronous reads can return immediately. Refresh runs in the
// background; the next read sees the updated values.
let cachedStatus: SdkNetworkStatus | null = null;

function statusToOnline(status: SdkNetworkStatus): boolean {
  return status !== 'OFFLINE';
}

function statusToEffectiveType(status: SdkNetworkStatus): EffectiveType {
  switch (status) {
    case '2G':
      return '2g';
    case '3G':
      return '3g';
    case '4G':
    case '5G':
    case 'WIFI':
    case 'WWAN':
    case 'UNKNOWN':
      return '4g';
    default:
      return '4g';
  }
}

function statusToConnectionType(status: SdkNetworkStatus): string {
  switch (status) {
    case 'WIFI':
      return 'wifi';
    case '2G':
    case '3G':
    case '4G':
    case '5G':
    case 'WWAN':
      return 'cellular';
    case 'OFFLINE':
      return 'none';
    default:
      return 'unknown';
  }
}

async function refresh(): Promise<void> {
  if (!(await isTossEnvironment())) return;
  const sdk = await loadTossSdk();
  const fn = (sdk as { getNetworkStatus?: unknown } | null)?.getNetworkStatus;
  if (typeof fn === 'function') {
    try {
      cachedStatus = (await (fn as () => Promise<SdkNetworkStatus>)()) as SdkNetworkStatus;
    } catch {
      // Keep prior cache on failure.
    }
  }
}

function makeConnection(): ConnectionLike {
  const status = cachedStatus ?? 'UNKNOWN';
  // Kick off refresh for subsequent reads. Fire-and-forget.
  void refresh();
  return {
    effectiveType: statusToEffectiveType(status),
    downlink: 10,
    rtt: 50,
    saveData: false,
    type: statusToConnectionType(status),
  };
}

export function installNetworkShim(): () => void {
  if (typeof navigator === 'undefined') {
    return () => {};
  }

  const host = navigator as unknown as BackupHost;
  if (host[INSTALLED_KEY]) {
    return () => uninstallNetworkShim();
  }

  host[ONLINE_BACKUP_KEY] = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(navigator) ?? navigator,
    'onLine',
  );
  host[CONNECTION_BACKUP_KEY] = Object.getOwnPropertyDescriptor(navigator, 'connection');
  host[INSTALLED_KEY] = true;

  // Seed the cache on install so the first sync read is meaningful.
  void refresh();

  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    get() {
      void refresh();
      if (cachedStatus !== null) {
        return statusToOnline(cachedStatus);
      }
      // Fall back to the native answer if we have no SDK data yet.
      const original = host[ONLINE_BACKUP_KEY];
      if (original?.get) return original.get.call(navigator);
      return true;
    },
  });

  Object.defineProperty(navigator, 'connection', {
    configurable: true,
    get() {
      return makeConnection();
    },
  });

  return uninstallNetworkShim;
}

export function uninstallNetworkShim(): void {
  if (typeof navigator === 'undefined') return;
  const host = navigator as unknown as BackupHost;
  if (!host[INSTALLED_KEY]) return;

  const originalOnLine = host[ONLINE_BACKUP_KEY];
  const originalConnection = host[CONNECTION_BACKUP_KEY];

  // Delete our override on the instance so the prototype descriptor (or
  // nothing) shows through again.
  delete (navigator as unknown as Record<string, unknown>).onLine;
  delete (navigator as unknown as Record<string, unknown>).connection;

  if (originalOnLine) {
    Object.defineProperty(Object.getPrototypeOf(navigator) ?? navigator, 'onLine', originalOnLine);
  }
  if (originalConnection) {
    Object.defineProperty(navigator, 'connection', originalConnection);
  }

  delete host[ONLINE_BACKUP_KEY];
  delete host[CONNECTION_BACKUP_KEY];
  delete host[INSTALLED_KEY];
  cachedStatus = null;
}
