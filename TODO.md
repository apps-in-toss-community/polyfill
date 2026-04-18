# TODO

## High Priority
(None)

## Medium Priority
- [ ] `navigator.geolocation.getCurrentPosition(success, error, options)` — map from SDK `getCurrentLocation({ accuracy })`. SDK returns a different `coords` shape; polyfill must convert to a standard `GeolocationPosition`. `enableHighAccuracy` bool → `accuracy` string.
- [ ] `navigator.geolocation.watchPosition(...)` / `clearWatch(id)` — SDK `startUpdateLocation` returns an `unsubscribe` fn; wrap it behind a numeric watch id to match the standard.
- [ ] `navigator.share({ text, url, title })` — SDK `share` only accepts `message`. Concatenate `title + text + url` into one string.
- [ ] `navigator.vibrate(pattern)` — loose mapping to SDK `generateHapticFeedback({ type })` (short number → `tickWeak`, long → `basicMedium`, pattern arrays → iterated `tap`). Document as best-effort. Whether to ship this in v1 is a judgement call (mapping is lossy).
- [ ] `navigator.onLine` + `navigator.connection.effectiveType` — wire up to SDK `getNetworkStatus()`. `'WIFI'` → `'4g'` (no web value for wifi), `'OFFLINE'` → `navigator.onLine = false`.

## Low Priority
- [ ] Ship CJS build alongside ESM if a consumer requests it (currently ESM-only, Node 24 + modern bundlers only).
- [ ] Confirm shim composition with `@ait-co/devtools` during sdk-example integration — when both are installed, SDK should be detected as "present" (pointing at the devtools mock) so polyfill routes through the mock as intended.

## Performance
(None)

## Backlog
- [ ] `window.localStorage` ↔ SDK `Storage.getItem/setItem/removeItem/clearItems` — **blocked on sync/async mismatch**. `localStorage` is sync, SDK `Storage` is async. Exposing a fresh `navigator.storage`-ish async wrapper is cleaner than racing the sync API; re-evaluate after Tier 1.
- [ ] `window.open(url)` ↔ SDK `openURL(url)` — different behaviour inside Toss (in-app browser). Whether to shim at all is a policy question.
- [ ] `history.back()` ↔ SDK `closeView()` — only makes sense at the top of the nav stack. Needs a reliable way to detect "top of stack."
- [ ] `document.visibilityState` ↔ SDK `onVisibilityChangedByTransparentServiceWeb` — browser already fires `visibilitychange`; SDK covers a Toss-specific transparent-web case. Skip unless a concrete use case appears.
- [ ] `Notification` / `ServiceWorkerRegistration.showNotification` — no direct SDK equivalent (push belongs to Toss's own channel). Revisit if that ever changes.
