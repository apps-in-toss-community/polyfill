/**
 * `navigator.share` shim.
 *
 * Inside Apps in Toss → routes through SDK `share({ message })`. The SDK only
 * accepts a single `message` string, so we concatenate `title`, `text`, and
 * `url` with newline separators (skipping missing/empty values).
 *
 * Outside Apps in Toss → defers to the browser's native `navigator.share`, or
 * throws `NotSupportedError` if unavailable.
 *
 * Caveat: the SDK's share has no counterpart for `files` (Web Share Level 2).
 * `canShare({ files })` returns `false` whenever the sync-accessible detection
 * says Toss is active (or is being forced via the test override).
 */

import { isTossEnvironment, isTossEnvironmentCached, loadTossSdk } from '../detect.js';
import {
  type InstallSnapshot,
  installNavigatorProperty,
  restoreNavigatorProperty,
} from './_install-helpers.js';

const SHARE_BACKUP_KEY = Symbol.for('@ait-co/polyfill/share.original');
const SHARE_SNAPSHOT_KEY = Symbol.for('@ait-co/polyfill/share.snapshot');
const CAN_SHARE_SNAPSHOT_KEY = Symbol.for('@ait-co/polyfill/canShare.snapshot');

type ShareFn = (data?: ShareData) => Promise<void>;
type CanShareFn = (data?: ShareData) => boolean;

interface Backup {
  share?: ShareFn | undefined;
  canShare?: CanShareFn | undefined;
  hadShare: boolean;
  hadCanShare: boolean;
}

interface BackupHost {
  [SHARE_BACKUP_KEY]?: Backup | undefined;
  [SHARE_SNAPSHOT_KEY]?: InstallSnapshot | undefined;
  [CAN_SHARE_SNAPSHOT_KEY]?: InstallSnapshot | undefined;
}

function buildSdkMessage(data: ShareData | undefined): string {
  // Use presence checks rather than truthiness so an intentionally empty
  // string in one field is handled correctly alongside a non-empty sibling.
  const parts: string[] = [];
  if (data?.title != null && data.title !== '') parts.push(data.title);
  if (data?.text != null && data.text !== '') parts.push(data.text);
  if (data?.url != null && data.url !== '') parts.push(data.url);
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
      try {
        await (fn as (o: { message: string }) => Promise<void>)({ message });
      } catch (e) {
        // Spec says navigator.share rejects with a DOMException. Wrap SDK
        // errors as AbortError (the most common cause is user cancellation),
        // attaching the original as `.cause` for Sentry-style telemetry.
        const message_ = e instanceof Error ? e.message : String(e);
        const wrapped = new DOMException(message_, 'AbortError');
        if (e instanceof Error) {
          (wrapped as Error).cause = e;
        }
        throw wrapped;
      }
      return;
    }
  }
  const host = navigator as unknown as BackupHost;
  const backup = host[SHARE_BACKUP_KEY];
  const original = backup?.share;
  if (!original) {
    throw new DOMException(
      '[@ait-co/polyfill] navigator.share is not available in this environment.',
      'NotSupportedError',
    );
  }
  return original.call(navigator, data);
}

function canShareShim(data?: ShareData): boolean {
  const hasFiles = Boolean(data?.files && data.files.length > 0);
  const toss = isTossEnvironmentCached();

  if (hasFiles) {
    // SDK does not share files. If we know we're in Toss (or it's being
    // forced), say so honestly. If detection hasn't resolved yet, be
    // pessimistic — a false negative is safer than promising a capability
    // we'll turn around and deny.
    if (toss === true) return false;
    if (toss === undefined) return false;
  }

  // Toss with non-file payloads: true iff there's at least one field.
  if (toss === true) {
    return Boolean(
      (data?.title != null && data.title !== '') ||
        (data?.text != null && data.text !== '') ||
        (data?.url != null && data.url !== ''),
    );
  }

  // `toss === undefined` (detection not resolved) with non-file payload falls
  // through to the browser-native answer. Rationale: `canShare` is rarely
  // load-bearing — consumers care about `share()` itself, which awaits the
  // async detection correctly. A false-negative here would needlessly hide a
  // Share button while detection settles.
  // Browser path: delegate to native when present.
  const host = navigator as unknown as BackupHost;
  const backup = host[SHARE_BACKUP_KEY];
  const originalCanShare = backup?.canShare;
  if (originalCanShare) {
    return originalCanShare.call(navigator, data);
  }
  return Boolean(
    (data?.title != null && data.title !== '') ||
      (data?.text != null && data.text !== '') ||
      (data?.url != null && data.url !== ''),
  );
}

export function installShareShim(): () => void {
  if (typeof navigator === 'undefined') {
    return () => {};
  }

  const host = navigator as unknown as BackupHost;
  if (SHARE_BACKUP_KEY in host) {
    // Already installed. Use `in` so the absence of `share` / `canShare` on
    // the pre-install navigator (legitimately stored as `undefined`) doesn't
    // re-trigger install.
    return () => uninstallShareShim();
  }

  const nav = navigator as Navigator & {
    share?: ShareFn;
    canShare?: CanShareFn;
  };
  host[SHARE_BACKUP_KEY] = {
    share: nav.share,
    canShare: nav.canShare,
    hadShare: 'share' in nav,
    hadCanShare: 'canShare' in nav,
  };

  host[SHARE_SNAPSHOT_KEY] = installNavigatorProperty('share', {
    value: shareShim,
    configurable: true,
    writable: true,
  });
  host[CAN_SHARE_SNAPSHOT_KEY] = installNavigatorProperty('canShare', {
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

  const shareSnap = host[SHARE_SNAPSHOT_KEY];
  if (shareSnap) restoreNavigatorProperty('share', shareSnap);
  const canShareSnap = host[CAN_SHARE_SNAPSHOT_KEY];
  if (canShareSnap) restoreNavigatorProperty('canShare', canShareSnap);

  delete host[SHARE_BACKUP_KEY];
  delete host[SHARE_SNAPSHOT_KEY];
  delete host[CAN_SHARE_SNAPSHOT_KEY];
}
