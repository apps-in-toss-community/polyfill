---
'@ait-co/polyfill': patch
---

Tier 1 verification status table + Tier 2 evaluation outcome documented.

- Records the verification matrix for the five Tier 1 shims (clipboard,
  geolocation, share, vibrate, network) across unit, devtools-composition,
  and sdk-example e2e layers. Real-Apps-in-Toss sanity awaits the
  `aitc-sdk-example` (miniApp `31146`) REVIEW lock release; that step is
  follow-up only and no shim changes are expected.
- Tier 2 evaluation against SDK 2.5.0: `localStorage`, `history.back`, and
  `visibilitychange` are formally moved to out-of-scope with rationale
  (SDK ships no Storage; `closeView` terminates the mini-app, not a nav
  pop; the standard Page Visibility API already works in the Apps in Toss
  WebView).
- New shim: `window.open` ↔ SDK `openURL`, deliberately limited. Routes
  only `target='_blank'` (or omitted target) through `openURL`; `_self`
  and named targets fall through to native. The returned value is a no-op
  stub `Window` (`closed: true`, `close` / `postMessage` / `focus` /
  `blur` are no-ops); SDK rejection is swallowed because `window.open`
  has no spec-level error channel. New `/window-open` subpath entry is
  exported and the new shim is part of the top-level `install()` /
  `uninstall()` composition.
