/**
 * @ait-co/polyfill
 *
 * Write Apps in Toss mini-apps using standard Web APIs
 * (`navigator.clipboard`, `navigator.geolocation`, …). This polyfill
 * transparently routes calls through the Apps in Toss SDK at runtime when
 * detected, and falls through to the browser's native implementation
 * otherwise.
 *
 * Unofficial community project. Not affiliated with Toss.
 */

export { isTossEnvironment, isTossEnvironmentCached, loadTossSdk } from './detect.js';
export { installClipboardShim, uninstallClipboardShim } from './shims/clipboard.js';
export { installGeolocationShim, uninstallGeolocationShim } from './shims/geolocation.js';
export { installNetworkShim, uninstallNetworkShim } from './shims/network.js';
export { installShareShim, uninstallShareShim } from './shims/share.js';
export { installVibrateShim, uninstallVibrateShim } from './shims/vibrate.js';

import { installClipboardShim, uninstallClipboardShim } from './shims/clipboard.js';
import { installGeolocationShim, uninstallGeolocationShim } from './shims/geolocation.js';
import { installNetworkShim, uninstallNetworkShim } from './shims/network.js';
import { installShareShim, uninstallShareShim } from './shims/share.js';
import { installVibrateShim, uninstallVibrateShim } from './shims/vibrate.js';

export const VERSION: string = __VERSION__;

/**
 * Install every shim this library ships. Idempotent — safe to call more than
 * once. Returns an uninstall function that restores every original API.
 *
 * Install order: clipboard → geolocation → share → vibrate → network.
 * `uninstall()` tears them down in the same order (each per-shim uninstall is
 * independent, so order doesn't affect correctness; documented for clarity).
 *
 * Not atomic on failure: if a later per-shim install throws (e.g., a consumer
 * has pinned one of the target navigator properties as non-configurable),
 * earlier shims are already installed. Callers should catch and invoke
 * `uninstall()` to roll back.
 */
export function install(): () => void {
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
