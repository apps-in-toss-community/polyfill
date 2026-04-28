# @ait-co/polyfill

> Part of the unofficial `apps-in-toss-community` project. Not affiliated with Toss.
> 비공식 커뮤니티 프로젝트입니다. 토스와 제휴하지 않았습니다.

Web standard API polyfill for Apps in Toss mini-apps. Write your mini-app with **standard Web APIs** (`navigator.clipboard`, `navigator.geolocation`, …) and have it transparently work inside Apps in Toss.

앱인토스 미니앱에서 **웹 표준 API를 그대로 사용**해서 개발할 수 있게 해주는 polyfill. 런타임에 앱인토스 환경으로 확인된 경우에만 SDK로 라우팅하는 shim을 설치하고, 그 외 환경(일반 브라우저, 로컬 개발, 테스트)에서는 **아무것도 하지 않아** 브라우저의 원본 구현이 그대로 동작합니다.

## Install

```sh
pnpm add @ait-co/polyfill
```

`@apps-in-toss/web-framework` is an **optional peer dependency**. Apps that only target a pure-web context don't need to install it — polyfill stays inert and the browser natives remain in charge.

```sh
pnpm add @apps-in-toss/web-framework   # only if you also ship a Toss build
```

## Usage

### Just add the dep (recommended)

Import the side-effect entry once at app start. Detection + install happens automatically; in a plain browser it's a no-op.

```ts
import '@ait-co/polyfill/auto';

// Anywhere later:
await navigator.clipboard.writeText('hello');
```

### Explicit install

If you need to know **when** the polyfill attached (to gate init) or to tear it down, call `install()` yourself:

```ts
import { install, uninstall } from '@ait-co/polyfill';

const restore = await install(); // resolves when detection completes

// ...

restore(); // or uninstall()
```

`install()` is async — the returned promise resolves with an uninstall function. When we're not inside Apps in Toss the returned function is a no-op, because no shim was installed. Calling `install()` more than once is safe.

Each shim stashes the original `navigator`/`window` value so `uninstall()` restores it cleanly — useful in tests.

### Subpath imports (bundle-size sensitive)

If you want to pick individual shims without the auto-install wiring:

```ts
import { installClipboardShim } from '@ait-co/polyfill/clipboard';

installClipboardShim(); // installs unconditionally — gate with detect.ts if you want Toss-only
```

The package is marked `sideEffects: ["./dist/auto.js"]`, so only the `/auto` entry is kept when tree-shaking; everything else is drop-if-unused.

## Environment detection

Polyfill calls `getAppsInTossGlobals()` from the SDK to decide whether we're actually inside Apps in Toss. That call is synchronous and reads a bridge constant — in a plain browser the RN bridge isn't attached and the call throws synchronously (microsecond-scale), so the startup cost is negligible.

You can override detection for tests via `globalThis.__AIT_POLYFILL_FORCE__ = 'toss' | 'browser'`.

## Supported APIs

Tier 1 — all shipped; paired SDK routing is live when inside Apps in Toss.

| Web standard | SDK counterpart | Landed in |
|---|---|---|
| `navigator.clipboard.readText()` / `writeText(text)` | `getClipboardText()` / `setClipboardText(text)` | 0.1.0 |
| `navigator.geolocation.getCurrentPosition()` | `getCurrentLocation({ accuracy })` | 0.1.1 |
| `navigator.geolocation.watchPosition()` / `clearWatch()` | `startUpdateLocation(...)` | 0.1.1 |
| `navigator.share({ title, text, url })` | `share({ message })` (concatenates into `message`) | 0.1.1 |
| `navigator.vibrate(pattern)` | `generateHapticFeedback(...)` (best-effort, lossy) | 0.1.1 |
| `navigator.onLine` / `navigator.connection.effectiveType` | `getNetworkStatus()` (poll on read; no `change` for seed) | 0.1.1 |

See [`TODO.md`](./TODO.md) for the full backlog and tiering.

APIs without a reasonable Web standard counterpart (auth, IAP, ads, analytics, Toss-specific environment info) stay in the `@apps-in-toss/web-framework` namespace — polyfill is not the home for "everything the SDK does." Rationale in [`CLAUDE.md`](./CLAUDE.md).

## Development

```sh
pnpm install
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```

### Pre-commit hook

Optional but recommended. After cloning, activate the standard pre-commit hook (runs `biome check` on staged files):

```sh
git config core.hooksPath .githooks
```

This is a developer convenience for fast feedback before push. CI runs the same checks as the enforcement layer, so contributors who don't activate the hook will still see lint failures in their PR.

## License

BSD-3-Clause
