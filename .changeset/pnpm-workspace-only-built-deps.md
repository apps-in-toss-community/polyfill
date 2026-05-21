---
"@ait-co/polyfill": patch
---

chore: add pnpm-workspace.yaml so sharp/esbuild build scripts run on fresh installs

`sharp` and `esbuild` had their postinstall build scripts silently ignored under pnpm 10 because no `onlyBuiltDependencies` allowlist existed. Add `pnpm-workspace.yaml` listing them (and ignoring `@sentry/cli`/`@swc/core`/`protobufjs`), matching the org standard.
