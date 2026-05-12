---
"@ait-co/polyfill": patch
---

Synthesize `change` events on `navigator.connection` via periodic polling (2 s interval, starts on first listener, stops on last removal — zero idle cost).
