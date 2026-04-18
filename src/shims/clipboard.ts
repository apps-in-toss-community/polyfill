/**
 * `navigator.clipboard` shim.
 *
 * Inside Apps in Toss → routes `readText` / `writeText` through the SDK
 * (`getClipboardText` / `setClipboardText`).
 *
 * Outside Apps in Toss → defers to the browser's native `navigator.clipboard`.
 * If the browser doesn't implement it, the standard `TypeError` / `DOMException`
 * surfaces unchanged — we don't paper over missing support.
 */

import { isTossEnvironment, loadTossSdk } from '../detect.js';

const BACKUP_KEY = Symbol.for('@ait-co/polyfill/clipboard.original');

interface BackupHost {
  [BACKUP_KEY]?: Clipboard | undefined;
}

/**
 * Produces a Clipboard-compatible object whose `readText` / `writeText` methods
 * route to the SDK when in Toss, else fall through to the supplied `fallback`.
 */
function createClipboardShim(fallback: Clipboard | undefined): Clipboard {
  const shim = {
    async readText(): Promise<string> {
      if (await isTossEnvironment()) {
        const sdk = await loadTossSdk();
        if (sdk?.getClipboardText) {
          return sdk.getClipboardText();
        }
      }
      if (!fallback) {
        throw new Error(
          '[@ait-co/polyfill] navigator.clipboard.readText is not available in this environment.',
        );
      }
      return fallback.readText();
    },

    async writeText(text: string): Promise<void> {
      if (await isTossEnvironment()) {
        const sdk = await loadTossSdk();
        if (sdk?.setClipboardText) {
          return sdk.setClipboardText(text);
        }
      }
      if (!fallback) {
        throw new Error(
          '[@ait-co/polyfill] navigator.clipboard.writeText is not available in this environment.',
        );
      }
      return fallback.writeText(text);
    },

    // `read` / `write` (ClipboardItem-based) are passed through to the
    // fallback when in browser mode; the SDK has no rich-content counterpart,
    // so in Toss mode they throw.
    async read(): Promise<ClipboardItems> {
      if (await isTossEnvironment()) {
        throw new Error(
          '[@ait-co/polyfill] navigator.clipboard.read (rich content) is not supported in the Apps in Toss environment. Use readText instead.',
        );
      }
      if (!fallback?.read) {
        throw new Error('[@ait-co/polyfill] navigator.clipboard.read is not available.');
      }
      return fallback.read();
    },

    async write(items: ClipboardItems): Promise<void> {
      if (await isTossEnvironment()) {
        throw new Error(
          '[@ait-co/polyfill] navigator.clipboard.write (rich content) is not supported in the Apps in Toss environment. Use writeText instead.',
        );
      }
      if (!fallback?.write) {
        throw new Error('[@ait-co/polyfill] navigator.clipboard.write is not available.');
      }
      return fallback.write(items);
    },

    // EventTarget passthrough. `navigator.clipboard` extends EventTarget in the
    // spec; mini-apps rarely use it, but we forward to the fallback when
    // possible so consumers don't lose functionality.
    addEventListener: (
      ...args: Parameters<EventTarget['addEventListener']>
    ): ReturnType<EventTarget['addEventListener']> => fallback?.addEventListener(...args),
    removeEventListener: (
      ...args: Parameters<EventTarget['removeEventListener']>
    ): ReturnType<EventTarget['removeEventListener']> => fallback?.removeEventListener(...args),
    dispatchEvent: (event: Event): boolean => fallback?.dispatchEvent(event) ?? false,
  } satisfies Clipboard;

  return shim;
}

/**
 * Install the `navigator.clipboard` shim.
 *
 * @returns an uninstall function that restores the original `navigator.clipboard`.
 *          Calling install twice without uninstalling is a no-op on the second call
 *          and returns the same uninstall function.
 */
export function installClipboardShim(): () => void {
  if (typeof navigator === 'undefined') {
    // No-op in non-DOM environments (pure Node).
    return () => {};
  }

  const host = navigator as unknown as BackupHost;
  if (host[BACKUP_KEY] !== undefined) {
    // Already installed. Return an uninstall that mirrors the stored backup.
    return () => uninstallClipboardShim();
  }

  const original = navigator.clipboard as Clipboard | undefined;
  host[BACKUP_KEY] = original;

  const shim = createClipboardShim(original);
  Object.defineProperty(navigator, 'clipboard', {
    value: shim,
    configurable: true,
    writable: true,
  });

  return uninstallClipboardShim;
}

/**
 * Remove the shim and restore the original `navigator.clipboard` (or leave it
 * `undefined` if the browser never had one).
 */
export function uninstallClipboardShim(): void {
  if (typeof navigator === 'undefined') return;
  const host = navigator as unknown as BackupHost;
  if (!(BACKUP_KEY in host)) return;

  const original = host[BACKUP_KEY];
  Object.defineProperty(navigator, 'clipboard', {
    value: original,
    configurable: true,
    writable: true,
  });
  delete host[BACKUP_KEY];
}
