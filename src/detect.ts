/**
 * Environment detection: are we running inside Apps in Toss, or a plain browser?
 *
 * Strategy: feature-sniff `@apps-in-toss/web-framework`. The SDK is declared as
 * an **optional** peer dependency. If it resolves and exposes a known export,
 * we assume we can route calls through it; otherwise we fall back to the
 * browser's native implementation in each shim.
 *
 * We deliberately avoid UA sniffing (spoofable) and avoid calling any SDK
 * function during detection (could prompt permission dialogs, fire analytics,
 * etc.).
 */

let cached: boolean | undefined;

/**
 * Reset the cached detection result. Primarily for tests.
 */
export function resetDetection(): void {
  cached = undefined;
}

/**
 * Returns `true` iff we detect we are running in an environment where the
 * Apps in Toss SDK (`@apps-in-toss/web-framework`) is present and usable.
 *
 * Async because we use dynamic `import()` to probe the optional peer dep
 * without forcing it into the consumer's bundle.
 */
export async function isTossEnvironment(): Promise<boolean> {
  // Override check precedes cache so `devtools` / tests can flip the result
  // mid-session without a `resetDetection()` call.
  const force = globalThis.__AIT_POLYFILL_FORCE__;
  if (force === 'toss') return true;
  if (force === 'browser') return false;

  if (cached !== undefined) return cached;

  const mod = await loadTossSdk();
  // Presence of a well-known export is our smoke test.
  cached = typeof mod?.getClipboardText === 'function';
  return cached;
}

/**
 * Lazy SDK accessor — returns the module if available, else `null`. Callers
 * are expected to `await` and null-check. Never throws.
 */
export async function loadTossSdk(): Promise<typeof import('@apps-in-toss/web-framework') | null> {
  try {
    return await import('@apps-in-toss/web-framework');
  } catch {
    return null;
  }
}
