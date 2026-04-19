---
'@ait-co/polyfill': patch
---

fix: use method-level install for geolocation, share, vibrate so Chromium's non-configurable `navigator.geolocation` own-property no longer shadows the shim

In 0.1.3 we added a prototype-level fallback for the descriptor install. That works when the instance property is just marked non-configurable, but Chromium makes `navigator.geolocation` a non-configurable own property whose *value* is the native Geolocation object — the instance shadows any prototype install, and the shim is never called.

0.1.4 switches geolocation/share/vibrate to mutate the methods on the existing object instead of replacing the whole property slot. The object's own methods are still configurable+writable in every browser we've tested, so the shim actually takes effect. Clipboard and network are unchanged (clipboard works with the descriptor approach; network has no method-level equivalent and now console.warns on browsers where the value slot is non-configurable).
