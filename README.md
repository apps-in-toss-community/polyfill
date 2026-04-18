# @ait-co/polyfill

> 🚧 **Work in Progress** — not yet published.
> 아직 개발 중입니다. 릴리스 전입니다.

Web standard API polyfill for [Apps in Toss](https://toss.im/) mini-apps. Write your mini-app with **standard Web APIs** (`navigator.clipboard`, `navigator.geolocation`, …) and have it transparently work inside Apps in Toss.

앱인토스 미니앱에서 **웹 표준 API를 그대로 사용**해서 개발할 수 있게 해주는 polyfill. 런타임에 앱인토스 환경을 감지해 내부적으로 `@apps-in-toss/web-framework` 호출로 라우팅하고, 그 외 환경(일반 브라우저, 로컬 개발, 테스트)에서는 브라우저의 원본 구현을 그대로 사용합니다 — no-op shim이 아닙니다.

Part of the unofficial `apps-in-toss-community` project. Not affiliated with Toss.

## Install

```sh
pnpm add @ait-co/polyfill
```

`@apps-in-toss/web-framework` is an **optional peer dependency**. Apps that only target a pure-web context don't need to install it — the shim falls through to the native browser path.

```sh
pnpm add @apps-in-toss/web-framework   # only if you also ship a Toss build
```

## Usage

### Side-effect import (recommended)

Install every covered shim once at app entry:

```ts
import '@ait-co/polyfill';

await navigator.clipboard.writeText('hello');
```

### Programmatic

```ts
import { install, uninstall } from '@ait-co/polyfill';

const restore = install();
// ...
uninstall(); // or call restore()
```

`install()` is idempotent. Each shim stashes the original `navigator`/`window` value so `uninstall()` restores it cleanly — useful in tests.

### Subpath imports (bundle-size sensitive)

Pick just the shims you need:

```ts
import '@ait-co/polyfill/clipboard';
import { isTossEnvironment } from '@ait-co/polyfill/detect';
```

## Supported APIs

| Web standard | SDK counterpart | Status |
|---|---|---|
| `navigator.clipboard.readText()` | `getClipboardText()` | ✅ shipped |
| `navigator.clipboard.writeText(text)` | `setClipboardText(text)` | ✅ shipped |
| `navigator.geolocation.*` | `getCurrentLocation` / `startUpdateLocation` | planned |
| `navigator.share(...)` | `share({ message })` | planned |
| `navigator.vibrate(pattern)` | `generateHapticFeedback(...)` | planned |
| `navigator.onLine` / `connection` | `getNetworkStatus()` | planned |

See [`TODO.md`](./TODO.md) for the full backlog and tiering.

APIs without a reasonable Web standard counterpart (auth, IAP, ads, analytics, Toss-specific environment info) stay in the `@apps-in-toss/web-framework` namespace — polyfill is not the home for "everything the SDK does." Rationale in [`CLAUDE.md`](./CLAUDE.md).

## Status

scaffold 완료, clipboard shim만 구현됨. 전체 로드맵은 [organization landing page](https://apps-in-toss-community.github.io/) 참고.

## License

BSD-3-Clause
