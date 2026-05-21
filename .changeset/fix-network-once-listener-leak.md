---
"@ait-co/polyfill": patch
---

fix(network): stop polling when a `{ once: true }` change listener auto-fires

When a consumer called `addEventListener('change', fn, { once: true })`, the
base `EventTarget` removed the listener internally after dispatch without
invoking the overridden `removeEventListener`, so `#changeListenerCount` never
decremented and the polling interval ran for the rest of the session.

The fix registers a paired internal one-shot cleanup listener (via `super`,
uncounted) that calls `#decrementChangeListeners()` after the once-listener
fires. If the consumer removes the listener before it fires, the cleanup
wrapper is cancelled at the same time and the count is decremented exactly
once by the `removeEventListener` override — no double-decrement.
