# @ait-co/polyfill

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
