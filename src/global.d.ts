// This is a script (no imports/exports), so all declarations here are global.

// Build-time define; replaced by tsdown/vitest so source code can reference
// the real package version without importing package.json at runtime.
declare const __VERSION__: string;

// Test/dev override. Consumers can set `globalThis.__AIT_POLYFILL_FORCE__` to
// 'toss' or 'browser' to bypass runtime detection. Primarily for tests.
declare var __AIT_POLYFILL_FORCE__: 'toss' | 'browser' | undefined;
