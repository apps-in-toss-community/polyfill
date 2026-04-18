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

export { isTossEnvironment, loadTossSdk, resetDetection } from './detect.js';
export { installClipboardShim, uninstallClipboardShim } from './shims/clipboard.js';

import { installClipboardShim, uninstallClipboardShim } from './shims/clipboard.js';

export const VERSION: string = __VERSION__;

/**
 * Install every shim this library ships. Idempotent — safe to call more than
 * once. Returns an uninstall function that restores every original API.
 *
 * Equivalent to `import '@ait-co/polyfill'` as a side-effect, but explicit.
 */
export function install(): () => void {
  const uninstalls = [installClipboardShim()];
  return () => {
    for (const fn of uninstalls) fn();
  };
}

/**
 * Uninstall every shim installed by `install()`. If a shim was already
 * uninstalled, this is a no-op for that entry.
 */
export function uninstall(): void {
  uninstallClipboardShim();
}
