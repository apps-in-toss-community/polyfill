# @ait-co/polyfill

## 0.1.4

### Patch Changes

- 75f231a: fix: use method-level install for geolocation, share, vibrate so Chromium's non-configurable `navigator.geolocation` own-property no longer shadows the shim

  In 0.1.3 we added a prototype-level fallback for the descriptor install. That works when the instance property is just marked non-configurable, but Chromium makes `navigator.geolocation` a non-configurable own property whose _value_ is the native Geolocation object — the instance shadows any prototype install, and the shim is never called.

  0.1.4 switches geolocation/share/vibrate to mutate the methods on the existing object instead of replacing the whole property slot. The object's own methods are still configurable+writable in every browser we've tested, so the shim actually takes effect. Clipboard and network are unchanged (clipboard works with the descriptor approach; network has no method-level equivalent and now console.warns on browsers where the value slot is non-configurable).

## 0.1.3

### Patch Changes

- Install shims at the prototype level when the instance property refuses to be
  redefined. Chromium now exposes `navigator.clipboard` / `.geolocation` /
  `.vibrate` / `.onLine` / `.connection` as **non-configurable own** properties
  on the `navigator` instance, so the previous
  `Object.defineProperty(navigator, …, { configurable: true })` call threw
  `TypeError: Cannot redefine property` and the install aborted mid-way.

  New strategy:

  1. Try instance-level install.
  2. If the browser refuses, install on `Navigator.prototype` instead and
     (best-effort) remove the instance shadow so the prototype accessor shows
     through on reads via `navigator.*`.

  A single install now completes all five shims in a real Chromium — the
  Toss-only gating introduced in 0.1.2 made this the only remaining blocker.

  Internal: adds `src/shims/_install-helpers.ts` and routes every shim's
  install/uninstall through it.

  Network shim also stops using the "delete-then-reinstall" shadow trick for
  fall-through reads — it captures the native `onLine` / `connection` values
  at install time and reads the cached references instead, which is
  compatible with prototype-level installs.

## 0.1.2

### Patch Changes

- Polyfill now installs shims **only** when we detect we are running inside the
  Apps in Toss runtime. In a plain browser it stays completely inert — the
  browser's native `navigator.clipboard` / `navigator.geolocation` / … are
  untouched.

  - Detection now probes `getAppsInTossGlobals()` from the SDK rather than
    just checking for a resolvable module export. Apps can bundle the SDK and
    still run in a plain browser, so module resolution alone is not a reliable
    signal; the bridge call either returns a real globals object (Toss) or
    throws synchronously (plain browser).
  - `install()` is now `async` and resolves with an uninstall function. When
    we're not inside Toss the returned uninstall is a no-op — no shim was
    installed, nothing to tear down.
  - New side-effect entry `@ait-co/polyfill/auto`. Add the dependency, write
    `import '@ait-co/polyfill/auto'` once at app start, and you're done — no
    explicit install call needed. In a plain browser it still does nothing.

  Upgrade notes: existing callers of `install()` must `await` the result. The
  previous synchronous signature was a footgun anyway (detection is async), so
  the change is low-impact in practice.
