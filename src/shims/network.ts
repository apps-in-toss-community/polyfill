/**
 * `navigator.onLine` + `navigator.connection` shim.
 *
 * Inside Apps in Toss → seeded from SDK `getNetworkStatus()` on install and
 * refreshed on read (throttled):
 *   - `'OFFLINE'`   → `onLine = false`
 *   - `'WIFI'`      → `onLine = true`, `effectiveType = '4g'` (no web wifi value)
 *   - `'2G'/'3G'/'4G'/'5G'` → `onLine = true`, `effectiveType = <lowercased>`
 *   - `'WWAN'/'UNKNOWN'`    → `onLine = true`, `effectiveType = '4g'` (best guess)
 *
 * Outside Apps in Toss → both `navigator.onLine` and `navigator.connection`
 * read through to the native value. Install installs own-instance getters
 * that consult the Toss-seeded cache first; when the cache is empty (which
 * it always is in browser mode), the getter temporarily removes its own
 * shadow, reads the prototype value, and reinstates the shadow.
 *
 * Uninstall `delete`s the instance-level override so the prototype descriptor
 * (where `onLine` and `connection` actually live in real browsers) becomes
 * visible again. We never mutate the prototype — doing so would throw in
 * browsers where the descriptor is non-configurable.
 *
 * Browser-compat caveat (Chromium): `navigator.onLine` and `navigator.connection`
 * are value slots, not methods, so the method-level install trick we use for
 * `geolocation`/`share`/`vibrate` does not apply here. When Chromium marks the
 * instance descriptor as non-configurable AND the prototype descriptor is also
 * non-configurable, we cannot install. In that case the shim logs a one-time
 * `console.warn` and leaves the native values in place — consumers keep the
 * browser's own `onLine`/`connection` values; the SDK-synced state is simply
 * disabled for that session.
 *
 * Caveat: the Web NetworkInformation API is evented (`change` fires on
 * transitions). The SDK exposes only a one-shot query, so listeners attached
 * to `navigator.connection` are accepted but never fire from a `change` event
 * unless the shim observes a real status transition. Synthesising richer
 * events via polling is tracked in TODO.md.
 *
 * Lifecycle: `navigator.connection` is a ShimConnection instance that lives in
 * the install closure. On uninstall the instance-level override is removed,
 * but listeners the consumer attached to the old instance stay bound to that
 * (now-orphan) object and will not see events from a subsequent install.
 * Consumers should re-attach listeners after each install.
 *
 * Seed-boundary race: in Toss mode, reads before the install-time SDK seed
 * completes fall through to the native `navigator.connection`. After the seed
 * lands, subsequent reads return the shim's ShimConnection. Consumers that
 * specifically need the ShimConnection instance (e.g., to attach `change`
 * listeners that fire on Toss network transitions) should wait a microtask
 * after `install()` before attaching listeners, or accept that pre-seed
 * reads may return the native object.
 */

import { isTossEnvironment, loadTossSdk } from '../detect.js';
import {
  type InstallSnapshot,
  installNavigatorProperty,
  restoreNavigatorProperty,
} from './_install-helpers.js';

const INSTALLED_KEY = Symbol.for('@ait-co/polyfill/network.installed');
const ON_LINE_SNAPSHOT_KEY = Symbol.for('@ait-co/polyfill/network.onLine.snapshot');
const CONNECTION_SNAPSHOT_KEY = Symbol.for('@ait-co/polyfill/network.connection.snapshot');

interface BackupHost {
  [INSTALLED_KEY]?: boolean;
  [ON_LINE_SNAPSHOT_KEY]?: InstallSnapshot | undefined;
  [CONNECTION_SNAPSHOT_KEY]?: InstallSnapshot | undefined;
}

type SdkNetworkStatus = 'OFFLINE' | 'WIFI' | '2G' | '3G' | '4G' | '5G' | 'WWAN' | 'UNKNOWN';
type EffectiveType = 'slow-2g' | '2g' | '3g' | '4g';

const REFRESH_THROTTLE_MS = 500;

function statusToOnline(status: SdkNetworkStatus): boolean {
  return status !== 'OFFLINE';
}

function statusToEffectiveType(status: SdkNetworkStatus): EffectiveType {
  switch (status) {
    case '2G':
      return '2g';
    case '3G':
      return '3g';
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

// Symbol-keyed setter: the install closure can mutate status without exposing
// a `setStatus` name on `navigator.connection` (real NetworkInformation has
// no mutator). `Object.getOwnPropertySymbols(navigator.connection)` returns
// nothing, so casual enumeration can't find it. A determined caller walking
// the prototype chain (`Object.getOwnPropertySymbols(Object.getPrototypeOf(...))`)
// can still surface the symbol — there is no trust boundary between polyfill
// and consumer code in the same realm, so this is a discouragement, not a
// security control.
const SET_STATUS = Symbol('@ait-co/polyfill/network.setStatus');

class ShimConnection extends EventTarget {
  #status: SdkNetworkStatus | null = null;
  onchange: ((this: ShimConnection, ev: Event) => unknown) | null = null;

  constructor() {
    super();
    // Forward `change` events to the legacy `onchange` handler for parity with
    // the NetworkInformation API.
    this.addEventListener('change', (ev) => this.onchange?.call(this, ev));
  }

  [SET_STATUS](next: SdkNetworkStatus | null): void {
    this.#status = next;
  }

  get effectiveType(): EffectiveType {
    return statusToEffectiveType(this.#status ?? 'UNKNOWN');
  }
  // `downlink` / `rtt` / `saveData` are placeholders — the SDK does not expose
  // these. We return 0/false rather than fabricate plausible numbers. Noted
  // in CLAUDE.md.
  get downlink(): number {
    return 0;
  }
  get rtt(): number {
    return 0;
  }
  get saveData(): boolean {
    return false;
  }
  get type(): string {
    return statusToConnectionType(this.#status ?? 'UNKNOWN');
  }
}

export function installNetworkShim(): () => void {
  if (typeof navigator === 'undefined') {
    return () => {};
  }

  const host = navigator as unknown as BackupHost;
  if (host[INSTALLED_KEY]) {
    return () => uninstallNetworkShim();
  }
  host[INSTALLED_KEY] = true;

  // Per-install state. Kept in closure so uninstall/reinstall cycles don't
  // leak state between instances (module-scope would leak across tests).
  let cachedStatus: SdkNetworkStatus | null = null;
  let lastRefresh = 0;
  let inflight: Promise<void> | null = null;
  const connection = new ShimConnection();

  async function refresh(): Promise<void> {
    // Coalesce concurrent refreshes — without this, rapid reads during an
    // in-flight SDK call each set `lastRefresh` and return early, without
    // anyone actually fetching fresh data.
    if (inflight) return inflight;
    const now = Date.now();
    if (now - lastRefresh < REFRESH_THROTTLE_MS) return;
    inflight = (async () => {
      try {
        if (!(await isTossEnvironment())) return;
        const sdk = await loadTossSdk();
        const fn = (sdk as { getNetworkStatus?: unknown } | null)?.getNetworkStatus;
        if (typeof fn !== 'function') return;
        const next = (await (fn as () => Promise<SdkNetworkStatus>)()) as SdkNetworkStatus;
        const prev = cachedStatus;
        cachedStatus = next;
        connection[SET_STATUS](next);
        // Only dispatch `change` on real transitions — the null → X seed on
        // first install is learning, not a transition, and would otherwise
        // mis-trigger consumer handlers.
        if (prev !== null && prev !== next) {
          connection.dispatchEvent(new Event('change'));
        }
      } catch {
        // Advisory — refresh failures keep the prior cache. `void refresh()`
        // callers would otherwise surface unhandled rejections if
        // isTossEnvironment / loadTossSdk / getNetworkStatus ever throw.
      } finally {
        lastRefresh = Date.now();
        inflight = null;
      }
    })();
    return inflight;
  }

  // Capture the native values **before** we install so the getters can fall
  // through without needing to temporarily remove their own shadow (which is
  // incompatible with prototype-level installs — Chromium keeps
  // `navigator.onLine` / `connection` non-configurable on the instance, so we
  // may end up installing on Navigator.prototype instead).
  const nativeOnLine = (navigator as Navigator & { onLine?: boolean }).onLine;
  const nativeConnection = (navigator as Navigator & { connection?: unknown }).connection;

  // Seed the cache on install so the first sync read is meaningful.
  void refresh();

  // Guard both descriptor installs with try/catch. These properties are value
  // slots that the plan calls out as not having a method-level equivalent;
  // when Chromium makes them non-configurable at both the instance and the
  // prototype, `installNavigatorProperty` may throw. In that case we warn once
  // and proceed — consumers keep the browser's native values.
  let installWarned = false;
  const warnNonConfigurable = (e: unknown): void => {
    if (installWarned) return;
    installWarned = true;
    console.warn(
      '[@ait-co/polyfill] navigator.onLine/connection is non-configurable in this browser; Toss network status sync disabled.',
      e,
    );
  };

  try {
    host[ON_LINE_SNAPSHOT_KEY] = installNavigatorProperty('onLine', {
      configurable: true,
      get() {
        void refresh();
        if (cachedStatus !== null) return statusToOnline(cachedStatus);
        return nativeOnLine ?? true;
      },
    });
  } catch (e) {
    warnNonConfigurable(e);
  }

  try {
    host[CONNECTION_SNAPSHOT_KEY] = installNavigatorProperty('connection', {
      configurable: true,
      get() {
        void refresh();
        if (cachedStatus === null && nativeConnection !== undefined) return nativeConnection;
        return connection;
      },
    });
  } catch (e) {
    warnNonConfigurable(e);
  }

  return uninstallNetworkShim;
}

export function uninstallNetworkShim(): void {
  if (typeof navigator === 'undefined') return;
  const host = navigator as unknown as BackupHost;
  if (!host[INSTALLED_KEY]) return;

  const onLineSnap = host[ON_LINE_SNAPSHOT_KEY];
  if (onLineSnap) restoreNavigatorProperty('onLine', onLineSnap);
  const connSnap = host[CONNECTION_SNAPSHOT_KEY];
  if (connSnap) restoreNavigatorProperty('connection', connSnap);

  delete host[INSTALLED_KEY];
  delete host[ON_LINE_SNAPSHOT_KEY];
  delete host[CONNECTION_SNAPSHOT_KEY];
}
