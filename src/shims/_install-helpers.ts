/**
 * Shared helpers for installing shims on `navigator`.
 *
 * Chromium now marks a handful of `navigator` properties (e.g. `geolocation`,
 * `clipboard`) as non-configurable **own** properties on the instance. That
 * means a plain `Object.defineProperty(navigator, 'x', …)` throws
 * `TypeError: Cannot redefine property`.
 *
 * The workaround is to shim at the prototype level — `Navigator.prototype`
 * keeps these as configurable accessors, so we can swap them there and every
 * instance that falls through to the prototype (including `window.navigator`)
 * sees the shim. We only reach for the prototype when the instance-level
 * assignment refuses.
 *
 * For restoration we remember the descriptor chain (instance + prototype) so
 * `uninstall()` puts the browser back in its original state.
 */

type PropertyLocation = 'instance' | 'prototype';

export interface InstallSnapshot {
  /** Where we ended up writing the shim. */
  location: PropertyLocation;
  /** Original descriptor at that location (may be undefined if nothing was there). */
  originalDescriptor: PropertyDescriptor | undefined;
  /** `true` iff the original property lived on the instance before we touched it. */
  instanceHadOwn: boolean;
}

/**
 * Install `descriptor` at `navigator[prop]`. Prefer instance-level; if the
 * browser refuses (property is non-configurable on the instance), install on
 * `Navigator.prototype` instead.
 *
 * Returns a snapshot describing where the original value was, which
 * `restoreNavigatorProperty` uses to undo the install.
 */
export function installNavigatorProperty(
  prop: string,
  descriptor: PropertyDescriptor,
): InstallSnapshot {
  const nav = navigator as unknown as Record<PropertyKey, unknown>;
  const instanceDesc = Object.getOwnPropertyDescriptor(nav, prop);
  const instanceHadOwn = instanceDesc !== undefined;

  // Fast path: instance-level property is missing or configurable.
  if (!instanceDesc || instanceDesc.configurable) {
    try {
      Object.defineProperty(nav, prop, descriptor);
      return { location: 'instance', originalDescriptor: instanceDesc, instanceHadOwn };
    } catch {
      // Fall through to prototype-level install.
    }
  }

  // Prototype-level install. Drop the instance-level shadow so the prototype
  // accessor is visible to readers on `navigator`.
  const proto = Object.getPrototypeOf(nav) as object;
  const protoDesc = Object.getOwnPropertyDescriptor(proto, prop);

  if (instanceHadOwn) {
    // Try to remove the instance-level shadow. On non-configurable it throws —
    // we deliberately ignore that; prototype-level install still wins because
    // the prototype accessor shows through when we read via `navigator[prop]`.
    try {
      delete nav[prop];
    } catch {
      /* non-configurable own — leave it; prototype install still useful */
    }
  }

  Object.defineProperty(proto, prop, descriptor);
  return { location: 'prototype', originalDescriptor: protoDesc, instanceHadOwn };
}

/**
 * Reverse the install recorded in `snapshot`. If the original descriptor was
 * `undefined` (property didn't exist before), delete the property instead of
 * re-defining it.
 */
export function restoreNavigatorProperty(prop: string, snapshot: InstallSnapshot): void {
  const target =
    snapshot.location === 'instance'
      ? (navigator as unknown as Record<PropertyKey, unknown>)
      : (Object.getPrototypeOf(navigator) as object);

  if (snapshot.originalDescriptor) {
    try {
      Object.defineProperty(target, prop, snapshot.originalDescriptor);
    } catch {
      /* descriptor was non-configurable upstream; we can't undo — rare. */
    }
  } else {
    try {
      // biome-ignore lint/performance/noDelete: property deletion is the uninstall intent
      delete (target as Record<PropertyKey, unknown>)[prop];
    } catch {
      /* non-configurable — rare. */
    }
  }

  // If our install pushed past an instance shadow, we leave the instance alone
  // — the descriptor we captured for `instanceHadOwn: true` lives on the
  // instance and was not modified at install time.
}
