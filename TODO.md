# TODO

## High Priority
(None)

## Medium Priority
- [ ] `sdk-example` 통합 — polyfill이 실제 Apps in Toss 환경에서 `navigator.clipboard.writeText()` / `navigator.geolocation.*` / `navigator.share(...)` / `navigator.vibrate(...)` / `navigator.onLine` 경로로 동작하는지 `sdk-example`의 각 ApiCard에서 확인. 이게 Tier 1의 품질 게이트.

## Low Priority
- [ ] Ship CJS build alongside ESM if a consumer requests it (currently ESM-only, Node 24 + modern bundlers only).
- [ ] Confirm shim composition with `@ait-co/devtools` during sdk-example integration — when both are installed, SDK should be detected as "present" (pointing at the devtools mock) so polyfill routes through the mock as intended.
- [ ] `navigator.connection` `change` event synthesis — 현재 SDK는 one-shot `getNetworkStatus()`만 노출하므로 shim은 read 시점에 lazy poll만 한다. 전환 감지가 필요한 소비자가 생기면 주기적 polling으로 `change` 이벤트를 합성하는 것을 고려.
- [ ] `navigator.vibrate` 패턴 매핑 정밀화 — 현재 `< 40ms → tickWeak`, `≥ 40ms → basicMedium`, 배열은 `tap` 반복. `success` / `error` 같은 semantic haptic으로 optionally opt-in하는 escape hatch를 둘지 검토.

## Performance
(None)

## Backlog
- [ ] `window.localStorage` ↔ SDK `Storage.getItem/setItem/removeItem/clearItems` — **blocked on sync/async mismatch**. `localStorage` is sync, SDK `Storage` is async. Exposing a fresh `navigator.storage`-ish async wrapper is cleaner than racing the sync API; re-evaluate after Tier 1.
- [ ] `window.open(url)` ↔ SDK `openURL(url)` — different behaviour inside Toss (in-app browser). Whether to shim at all is a policy question.
- [ ] `history.back()` ↔ SDK `closeView()` — only makes sense at the top of the nav stack. Needs a reliable way to detect "top of stack."
- [ ] `document.visibilityState` ↔ SDK `onVisibilityChangedByTransparentServiceWeb` — browser already fires `visibilitychange`; SDK covers a Toss-specific transparent-web case. Skip unless a concrete use case appears.
- [ ] `Notification` / `ServiceWorkerRegistration.showNotification` — no direct SDK equivalent (push belongs to Toss's own channel). Revisit if that ever changes.
