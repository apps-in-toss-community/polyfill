/**
 * `navigator.share` shim.
 *
 * Inside Apps in Toss → routes through SDK `share({ message })`.
 * The SDK only accepts a single `message` string, so we concatenate
 * `title`, `text`, and `url` with newline separators (skipping empties).
 *
 * Outside Apps in Toss → defers to the browser's native `navigator.share`,
 * or throws `NotSupportedError` if unavailable.
 *
 * Caveat: the SDK's share has no counterpart for `files` (Web Share Level 2).
 * `canShare({ files })` returns `false` in Toss mode.
 */

import { isTossEnvironment, loadTossSdk } from '../detect.js';

const SHARE_BACKUP_KEY = Symbol.for('@ait-co/polyfill/share.original');
const CAN_SHARE_BACKUP_KEY = Symbol.for('@ait-co/polyfill/canShare.original');

interface BackupHost {
  [SHARE_BACKUP_KEY]?: ((data?: ShareData) => Promise<void>) | undefined;
  [CAN_SHARE_BACKUP_KEY]?: ((data?: ShareData) => boolean) | undefined;
}

function buildSdkMessage(data: ShareData | undefined): string {
  const parts: string[] = [];
  if (data?.title) parts.push(data.title);
  if (data?.text) parts.push(data.text);
  if (data?.url) parts.push(data.url);
  return parts.join('\n');
}

async function shareShim(data?: ShareData): Promise<void> {
  if (await isTossEnvironment()) {
    const sdk = await loadTossSdk();
    const fn = (sdk as { share?: unknown } | null)?.share;
    if (typeof fn === 'function') {
      const message = buildSdkMessage(data);
      if (!message) {
        throw new TypeError(
          '[@ait-co/polyfill] navigator.share requires at least one of title, text, or url.',
        );
      }
      await (fn as (o: { message: string }) => Promise<void>)({ message });
      return;
    }
  }
  const host = navigator as unknown as BackupHost;
  const original = host[SHARE_BACKUP_KEY];
  if (!original) {
    throw new DOMException(
      '[@ait-co/polyfill] navigator.share is not available in this environment.',
      'NotSupportedError',
    );
  }
  return original.call(navigator, data);
}

function canShareShim(data?: ShareData): boolean {
  // The SDK's `share` does not handle files; advertise that honestly.
  if (data?.files && data.files.length > 0) {
    // In browser mode we still want to delegate so browsers that *do* support
    // file sharing can return true. Detection is async, so this must be a
    // best-effort sync answer. If a fallback exists, trust it.
    const host = navigator as unknown as BackupHost;
    const originalCanShare = host[CAN_SHARE_BACKUP_KEY];
    if (originalCanShare) {
      return originalCanShare.call(navigator, data);
    }
    return false;
  }
  // Anything with at least one of title/text/url is shareable in Toss; in a
  // browser, delegate to native when available.
  const host = navigator as unknown as BackupHost;
  const originalCanShare = host[CAN_SHARE_BACKUP_KEY];
  if (originalCanShare) {
    return originalCanShare.call(navigator, data);
  }
  return Boolean(data?.title || data?.text || data?.url);
}

export function installShareShim(): () => void {
  if (typeof navigator === 'undefined') {
    return () => {};
  }

  const host = navigator as unknown as BackupHost;
  if (SHARE_BACKUP_KEY in host) {
    return () => uninstallShareShim();
  }

  const originalShare = (navigator as Navigator & { share?: (d?: ShareData) => Promise<void> })
    .share;
  const originalCanShare = (navigator as Navigator & { canShare?: (d?: ShareData) => boolean })
    .canShare;
  host[SHARE_BACKUP_KEY] = originalShare;
  host[CAN_SHARE_BACKUP_KEY] = originalCanShare;

  Object.defineProperty(navigator, 'share', {
    value: shareShim,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(navigator, 'canShare', {
    value: canShareShim,
    configurable: true,
    writable: true,
  });

  return uninstallShareShim;
}

export function uninstallShareShim(): void {
  if (typeof navigator === 'undefined') return;
  const host = navigator as unknown as BackupHost;
  if (!(SHARE_BACKUP_KEY in host)) return;

  const originalShare = host[SHARE_BACKUP_KEY];
  const originalCanShare = host[CAN_SHARE_BACKUP_KEY];
  Object.defineProperty(navigator, 'share', {
    value: originalShare,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(navigator, 'canShare', {
    value: originalCanShare,
    configurable: true,
    writable: true,
  });
  delete host[SHARE_BACKUP_KEY];
  delete host[CAN_SHARE_BACKUP_KEY];
}
