---
'@ait-co/polyfill': patch
---

Initial scaffold: runtime Apps in Toss environment detection (`isTossEnvironment`), a reference `navigator.clipboard` shim that routes `readText` / `writeText` through `@apps-in-toss/web-framework` when detected and falls through to the browser's native clipboard otherwise, and `install()` / `uninstall()` entry points.
