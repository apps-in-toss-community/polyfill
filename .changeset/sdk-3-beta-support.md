---
"@ait-co/polyfill": patch
---

chore: widen peerDependency to support @apps-in-toss/web-framework 3.x

`peerDependencies["@apps-in-toss/web-framework"]` was `>=2.4.0 <3.0.0` which
explicitly excluded the 3.0 line. Widened to `>=2.4.0 <4.0.0` so that
consumers on the 3.0 beta (and future stable 3.x) no longer get a peer
conflict. Updated devDependency to `3.0.0-beta.9d42c0b`.

All 8 shim function names (`getClipboardText`, `setClipboardText`,
`getCurrentLocation`, `startUpdateLocation`, `share`, `generateHapticFeedback`,
`getNetworkStatus`, `openURL`) are unchanged in 3.0, so no shim code changes
were needed. Hardcoded `Accuracy` values `Balanced=3` / `High=4` remain valid.
