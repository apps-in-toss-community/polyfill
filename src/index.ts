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

export { isTossEnvironment, loadTossSdk } from './detect.js';
export { installClipboardShim, uninstallClipboardShim } from './shims/clipboard.js';

import { installClipboardShim, uninstallClipboardShim } from './shims/clipboard.js';

export const VERSION: string = __VERSION__;

/**
 * Install every shim this library ships. Idempotent — safe to call more than
 * once. Returns an uninstall function that restores every original API.
 */
export function install(): () => void {
  const uninstalls = [installClipboardShim()];
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
}
