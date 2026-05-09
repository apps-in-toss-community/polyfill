---
'@ait-co/polyfill': patch
---

`navigator.vibrate` mapping is more precise: single-duration calls now bucket into `tickWeak` (1–20ms), `tickMedium` (21–45ms), and `basicMedium` (≥46ms) inside Apps in Toss. For callers that know their intent (`'success' | 'error' | 'warning' | 'selection'`), a new `vibrateSemantic` helper is exported from `@ait-co/polyfill/vibrate-semantic` and routes to the SDK's matching haptic. The standard `navigator.vibrate(pattern)` signature and return value are unchanged.
