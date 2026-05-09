---
'@ait-co/polyfill': patch
---

Ship a CommonJS build alongside the existing ESM output. `require('@ait-co/polyfill')` (and every subpath: `/clipboard`, `/geolocation`, `/share`, `/vibrate`, `/network`, `/detect`, `/auto`) now works in CJS hosts; ESM consumers are unaffected. No API surface changes.
