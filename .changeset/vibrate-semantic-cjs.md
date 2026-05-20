---
"@ait-co/polyfill": patch
---

fix: ship CJS build for the `vibrate-semantic` subpath export

`@ait-co/polyfill/vibrate-semantic` was the only subpath built ESM-only — its `tsdown` entry used `format: ['esm']` and `package.json` exports lacked a `require` condition, so `require('@ait-co/polyfill/vibrate-semantic')` failed even though the README documents it as a normal subpath (and the root entry that re-exports it is dual-format). It now emits `.cjs`/`.d.cts` alongside ESM like every other shim.
