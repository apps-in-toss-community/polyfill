import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// Each test run needs a clean slate so multiple test files don't interfere.
// We delete the property before each test (Object.defineProperty is
// configurable:false in real usage but vitest/jsdom resets the environment
// per file, so deletion between tests within this file is fine here).

// Helper to reset the sentinel between tests (only possible because jsdom
// resets globalThis descriptors between test files; within the file we
// need to delete + re-import via dynamic import to get a fresh execution).

describe('__AIT_POLYFILL__ sentinel', () => {
  beforeEach(() => {
    // Delete any existing sentinel from a previous test so we can re-define.
    // In production the property is non-configurable, but jsdom lets us do
    // this because the global object itself is replaceable between test runs.
    try {
      delete (globalThis as Record<string, unknown>).__AIT_POLYFILL__;
    } catch {
      // ignore if already non-configurable (shouldn't happen in jsdom)
    }
  });

  afterEach(() => {
    try {
      delete (globalThis as Record<string, unknown>).__AIT_POLYFILL__;
    } catch {
      // ignore
    }
  });

  it('is defined after importing sentinel', async () => {
    // Dynamic import forces re-execution of the module body in this test.
    await import('../sentinel.js');
    expect(globalThis.__AIT_POLYFILL__).toBeDefined();
  });

  it('has version string and loaded:true', async () => {
    await import('../sentinel.js');
    const sentinel = globalThis.__AIT_POLYFILL__;
    expect(typeof sentinel?.version).toBe('string');
    expect(sentinel?.version.length).toBeGreaterThan(0);
    expect(sentinel?.loaded).toBe(true);
  });

  it('write attempt is silently ignored (non-writable)', async () => {
    await import('../sentinel.js');
    const original = globalThis.__AIT_POLYFILL__;

    // In non-strict mode a write is silently ignored; in strict mode it throws.
    // Either way the value must not change.
    try {
      (globalThis as Record<string, unknown>).__AIT_POLYFILL__ = {
        version: 'overwritten',
        loaded: true,
      };
    } catch {
      // strict mode throw is acceptable
    }
    expect(globalThis.__AIT_POLYFILL__).toBe(original);
  });

  it('is non-enumerable (does not appear in for…in / Object.keys)', async () => {
    await import('../sentinel.js');
    // Object.keys only returns own enumerable properties.
    expect(Object.keys(globalThis)).not.toContain('__AIT_POLYFILL__');
    // Confirm the property IS accessible directly even though non-enumerable.
    expect(globalThis.__AIT_POLYFILL__).toBeDefined();
  });

  it('is defined when importing the package root (index)', async () => {
    // Re-set before importing root to avoid stale value from above tests.
    try {
      delete (globalThis as Record<string, unknown>).__AIT_POLYFILL__;
    } catch {
      // ignore
    }
    await import('../index.js');
    expect(globalThis.__AIT_POLYFILL__).toBeDefined();
  });
});
