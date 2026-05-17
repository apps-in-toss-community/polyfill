/**
 * Devtools sentinel — read-only global marker that signals polyfill presence.
 *
 * Sets `globalThis.__AIT_POLYFILL__` once as a non-writable, non-enumerable,
 * non-configurable property so devtools (and nothing else) can detect which
 * version of the polyfill is loaded.
 *
 * **Privacy guarantee**: no network call is made here. The sentinel contains
 * only the package version (public information) and a boolean flag. Devtools
 * may read this value and include it in an anonymous ping — but only when
 * devtools opt-out is not applied by the user.
 *
 * This module must be imported as a side-effect from every entry point so the
 * sentinel is always set regardless of which entry the consumer chose.
 */

// Declared in src/global.d.ts so TypeScript accepts the __VERSION__ reference.
const SENTINEL_VALUE = Object.freeze({
  version: __VERSION__,
  loaded: true,
} as const);

if (typeof globalThis !== 'undefined') {
  try {
    Object.defineProperty(globalThis, '__AIT_POLYFILL__', {
      value: SENTINEL_VALUE,
      writable: false,
      enumerable: false,
      configurable: false,
    });
  } catch {
    // Already defined (e.g. multiple polyfill instances on the same page) or
    // globalThis is sealed/frozen in the host — silently ignore.
  }
}
