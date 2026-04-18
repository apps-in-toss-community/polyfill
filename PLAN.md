# @ait-co/polyfill — Plan

> Status: **living document**. Review and amend before expanding API coverage.
>
> This repo is part of the unofficial `apps-in-toss-community` project. Not affiliated with Toss.

## Why

Apps in Toss's `@apps-in-toss/web-framework` exposes a **proprietary set of APIs**
(`setClipboardText`, `getCurrentLocation`, `generateHapticFeedback`, `share`, …)
for capabilities that the **web platform already has standard APIs for**
(`navigator.clipboard`, `navigator.geolocation`, `navigator.vibrate`, `navigator.share`, …).

`@ait-co/polyfill` lets developers write mini-apps using only standard Web APIs.
When the code runs inside Toss, the polyfill transparently re-routes calls to the SDK.
Outside Toss (vanilla browser, local dev, Storybook, tests), the browser's native
implementation is used as-is — no shim, no no-op.

Contrast with `@ait-co/devtools`:

| | devtools | polyfill |
|---|---|---|
| Direction | SDK → browser (mock the SDK) | Web standard → SDK (shim standard onto SDK) |
| What the user writes | SDK calls (`setClipboardText(...)`) | Standard APIs (`navigator.clipboard.writeText(...)`) |
| Where it runs | Browser dev only | **Both** (Toss and browser) |

They are complementary. A typical dev-mode setup can use **both** — author against
web standards (polyfill), and use devtools to mock the fallback path for browser dev.

## Design principles

1. **Standard first.** The developer writes `navigator.clipboard.writeText(...)`. The
   polyfill is an *environment adapter*, never a new API surface.
2. **No-op avoidance.** Outside Toss, defer to the browser's real implementation.
   If the browser does not support it either, surface the standard error (e.g.
   `NotAllowedError`) — do not silently swallow.
3. **Tree-shakable.** Each shim is its own module so unused APIs stay out of the
   bundle. `install()` and per-API entry points (`@ait-co/polyfill/clipboard`)
   both supported.
4. **Small surface.** Polyfill only covers APIs that have a *reasonable* 1:1 mapping.
   Things without a web-standard counterpart (IAP, TossPay, AppLogin, Ads, Analytics,
   Haptic feedback types beyond vibrate, Game Center, …) stay in the SDK namespace.
5. **`@apps-in-toss/web-framework` is an optional peer dep.** Apps that pull polyfill
   into a pure-web context don't need the SDK installed — the shim falls through to
   the native browser path.

## Scope: what gets polyfilled

### Tier 1 — ship first (pick one → clipboard for the reference impl)

| Web standard | SDK counterpart | Notes |
|---|---|---|
| `navigator.clipboard.readText()` | `getClipboardText()` | Permission model differs; polyfill surfaces `NotAllowedError` on denial. **Reference implementation shipped in this PR.** |
| `navigator.clipboard.writeText(text)` | `setClipboardText(text)` | Same as above. Reference impl. |
| `navigator.geolocation.getCurrentPosition(success, error, options)` | `getCurrentLocation({ accuracy })` | SDK returns different `coords` shape — polyfill converts to standard `GeolocationPosition`. Accuracy maps from `enableHighAccuracy` bool. |
| `navigator.geolocation.watchPosition(...)` / `clearWatch(id)` | `startUpdateLocation(...)` | SDK returns an `unsubscribe` fn, polyfill wraps it behind a numeric watch id like the standard. |
| `navigator.share({ text, url, title })` | `share({ message })` | SDK only accepts `message`. Polyfill concatenates `title + text + url` into one string. |
| `navigator.vibrate(pattern)` | `generateHapticFeedback({ type })` | Loose mapping: short number → `tickWeak`, long → `basicMedium`, pattern arrays → iterated `tap`. Documented as best-effort. |
| `navigator.onLine` + `connection.effectiveType` | `getNetworkStatus()` | SDK returns `'WIFI' \| '4G' \| ... \| 'OFFLINE'`. Polyfill exposes as `navigator.connection.effectiveType` (degraded — `'WIFI'` → `'4g'` since no web value exists) and updates `navigator.onLine`. |

### Tier 2 — evaluate after Tier 1 stabilises

| Web standard | SDK counterpart | Blocker / open question |
|---|---|---|
| `window.localStorage` (quota-aware async API is Storage Access / IndexedDB) | `Storage.getItem/setItem/removeItem/clearItems` | SDK Storage is **async**. `localStorage` is sync. Exposing a new `navigator.storage`-ish async wrapper is cleaner than racing the sync API. |
| `window.open(url)` | `openURL(url)` | Different behaviour (Toss: in-app browser). Whether to shim is a policy question. |
| `history.back()` | `closeView()` | Only makes sense at the top of the nav stack. |
| `Notification` / `ServiceWorkerRegistration.showNotification` | (no direct SDK equivalent — push belongs to Toss's own channel) | Skip for now. |
| `document.visibilityState` | `onVisibilityChangedByTransparentServiceWeb` | Browser already fires `visibilitychange`. SDK covers a Toss-specific transparent-web case. Skip. |

### Out of scope (SDK-only, no reasonable standard)

- `appLogin`, `getUserKeyForGame`, `appsInTossSignTossCert` — auth (see `oidc-bridge` repo for the standards-based path)
- `checkoutPayment`, `IAP` — payments
- `GoogleAdMob`, `TossAds` — ads
- `Analytics`, `eventLog`, `tdsEvent` — analytics
- `getTossShareLink`, `requestReview`, `getPlatformOS`, `getOperationalEnvironment`,
  `getTossAppVersion`, `getDeviceId`, `getLocale`, etc. — Toss-specific environment info
- Game center, promotions, safe-area insets, screen-awake mode, secure screen

These stay in the `@apps-in-toss/web-framework` namespace. Developers who want them
import them directly — polyfill is not the home for "everything the SDK does."

## Architecture

### Entry-point strategy

Three layers, from most opinionated to least:

1. **`import '@ait-co/polyfill'`** (side-effect): calls `installAll()` — replaces
   every covered standard API on `navigator` / `window` with the shim. **This is what
   most app authors want.**
2. **`import { install } from '@ait-co/polyfill'`**: programmatic form of the above.
   Useful for "install only if feature detection says we need to."
3. **Per-API imports** — `import '@ait-co/polyfill/clipboard'` etc. — for bundle-size
   sensitive consumers who want just one or two shims.

Shims are installed **idempotently** (re-calling `install()` is a no-op after the
first). Each shim stashes the original `navigator.clipboard`/etc. on a
`Symbol`-keyed backup so tests and advanced consumers can restore. `uninstall()`
exposes that.

### Environment detection (`src/detect.ts`)

A single `isTossEnvironment()` function. Strategy:

1. Feature-sniff `@apps-in-toss/web-framework` being present and usable at runtime
   (dynamic import + try/catch). This is the **only reliable signal**. UA strings
   are spoofable and the SDK itself doesn't expose a `window.__AIT__` global.
2. Result is cached after first call.
3. An override hook (`__AIT_POLYFILL_FORCE__` on `globalThis`) lets tests and
   devtools flip the result without mocking ESM imports.

Note: we **do not** call SDK functions during detection — just confirm the module
loads and exports `getClipboardText` (or any other well-known export). Actual
API calls happen lazily inside each shim.

### Per-shim structure

```ts
// src/shims/clipboard.ts
export function installClipboardShim(): () => void {
  const original = navigator.clipboard;
  // define a replacement that routes through SDK when in Toss, else falls back to `original`
  Object.defineProperty(navigator, 'clipboard', { value: replacement, configurable: true });
  return () => Object.defineProperty(navigator, 'clipboard', { value: original, configurable: true });
}
```

Each shim returns an **uninstall function** — `installAll()` composes them.

### Build

- `tsdown` — matches devtools / org standard.
- ESM only for now (Node 24, modern bundlers). CJS added later if a consumer needs it.
- Multiple entry points: `index`, `clipboard`, `detect` (for advanced users).
- `target: es2022`, DTS + sourcemaps on.

### Testing

- `vitest` with **jsdom** env (matches devtools).
- Each shim's tests assert **three paths**:
  1. Toss present (mock `@apps-in-toss/web-framework` via `vi.mock`)
  2. Browser-only (default jsdom `navigator.clipboard`)
  3. Neither (jsdom without clipboard) → standard error surfaces
- No `happy-dom` — jsdom keeps parity with devtools and is sufficient for our
  level of DOM fidelity.

### Linting & formatting

- Biome with the org config (copied from devtools `biome.json`).
- `noExplicitAny: error`. Any unavoidable `any` gets a `biome-ignore` comment.

### Versioning & release

- `0.1.x` patch-only until `agent-plugin` integration lands, per umbrella policy.
- First changeset is **patch**. Claude may not bump minor/major without explicit
  instruction.
- Changesets → `changesets/action` → npm publish (reuses the release workflow
  already bootstrapped).

## Open questions

1. **Shim composition with devtools.** If a developer installs both devtools (SDK
   mock) **and** polyfill, is the SDK auto-detected as "present" (pointing at the
   mock), so polyfill happily routes through the mock? That's the intended
   behaviour — confirm during sdk-example integration.
2. **`navigator.vibrate` fidelity.** The mapping from pattern arrays to discrete
   haptic types is lossy. Whether to ship this at all in v1 is a judgement call.
3. **TypeScript ambient types.** Since polyfill mutates `navigator`, consumers'
   TS already sees the right types (DOM lib). We don't need to ship augmentations
   unless we expose Toss-specific extras (we don't — that's the SDK's job).

## Roadmap

1. **This PR** — scaffold + clipboard shim + PLAN. `0.1.0`.
2. **Next PR** — geolocation shim + network status shim. `0.1.1`.
3. **After** — share, vibrate. `0.1.2`.
4. **sdk-example integration** — rewrite a sample page in sdk-example to use
   `navigator.clipboard.writeText()` through polyfill; confirm it works in both
   the browser (with devtools) and a real Toss environment.
5. **1.0.0** — coordinated with agent-plugin ship. Per Dave's explicit instruction.
