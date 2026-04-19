/**
 * @ait-co/polyfill
 *
 * Write Apps in Toss mini-apps using standard Web APIs
 * (`navigator.clipboard`, `navigator.geolocation`, …). This polyfill routes
 * calls through the Apps in Toss SDK **only when we detect we are actually
 * running inside the Toss app** — in every other environment (a plain browser,
 * local dev, tests) the shims are not installed and the browser's native
 * implementations are used as-is.
 *
 * Unofficial community project. Not affiliated with Toss.
 */

export { isTossEnvironment, isTossEnvironmentCached, loadTossSdk } from './detect.js';
export { installClipboardShim, uninstallClipboardShim } from './shims/clipboard.js';
export { installGeolocationShim, uninstallGeolocationShim } from './shims/geolocation.js';
export { installNetworkShim, uninstallNetworkShim } from './shims/network.js';
export { installShareShim, uninstallShareShim } from './shims/share.js';
export { installVibrateShim, uninstallVibrateShim } from './shims/vibrate.js';

import { isTossEnvironment } from './detect.js';
import { installClipboardShim, uninstallClipboardShim } from './shims/clipboard.js';
import { installGeolocationShim, uninstallGeolocationShim } from './shims/geolocation.js';
import { installNetworkShim, uninstallNetworkShim } from './shims/network.js';
import { installShareShim, uninstallShareShim } from './shims/share.js';
import { installVibrateShim, uninstallVibrateShim } from './shims/vibrate.js';

export const VERSION: string = __VERSION__;

const NOOP = (): void => {};

/**
 * Install every shim this library ships, but only if we detect an Apps in
 * Toss runtime. In a plain browser `install()` is a no-op — the browser's
 * native APIs stay untouched.
 *
 * Returns a promise that resolves with an uninstall function. If the
 * environment turns out not to be Toss, the uninstall function is a no-op.
 *
 * Install order (when active): clipboard → geolocation → share → vibrate →
 * network. Not atomic on failure — if a per-shim install throws (e.g., a
 * consumer pinned a target navigator property as non-configurable), earlier
 * shims are already in place. Callers should catch and invoke the returned
 * uninstall to roll back.
 */
export async function install(): Promise<() => void> {
  if (!(await isTossEnvironment())) return NOOP;
  const uninstalls = [
    installClipboardShim(),
    installGeolocationShim(),
    installShareShim(),
    installVibrateShim(),
    installNetworkShim(),
  ];
  return () => {
    for (const fn of uninstalls) fn();
  };
}

/**
 * Uninstall every shim installed by `install()`. Safe to call when no shim is
 * installed — each installer's uninstall is a no-op in that case.
 */
export function uninstall(): void {
  uninstallClipboardShim();
  uninstallGeolocationShim();
  uninstallShareShim();
  uninstallVibrateShim();
  uninstallNetworkShim();
}
