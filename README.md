# @ait-co/polyfill

> 🚧 **Pre-release (0.1.x)** — implemented, pending `sdk-example` integration verification.
> Part of the unofficial `apps-in-toss-community` project. Not affiliated with Toss.
> 비공식 커뮤니티 프로젝트입니다. 토스와 제휴하지 않았습니다.

Web standard API polyfill for Apps in Toss mini-apps. Write your mini-app with **standard Web APIs** (`navigator.clipboard`, `navigator.geolocation`, …) and have it transparently work inside Apps in Toss.

앱인토스 미니앱에서 **웹 표준 API를 그대로 사용**해서 개발할 수 있게 해주는 polyfill. 런타임에 앱인토스 환경을 감지해 내부적으로 `@apps-in-toss/web-framework` 호출로 라우팅하고, 그 외 환경(일반 브라우저, 로컬 개발, 테스트)에서는 브라우저의 원본 구현을 그대로 사용합니다 — no-op shim이 아닙니다.

## Install

```sh
pnpm add @ait-co/polyfill
```

`@apps-in-toss/web-framework` is an **optional peer dependency**. Apps that only target a pure-web context don't need to install it — the shim falls through to the native browser path.

```sh
pnpm add @apps-in-toss/web-framework   # only if you also ship a Toss build
```

## Usage

### Install every shim (recommended)

Call `install()` once at app entry:

```ts
import { install } from '@ait-co/polyfill';

install();

await navigator.clipboard.writeText('hello');
```

`install()` is idempotent — calling it again is a no-op. It returns an uninstall function; a top-level `uninstall()` is also exported for convenience.

```ts
import { install, uninstall } from '@ait-co/polyfill';

const restore = install();
// ...
restore(); // or uninstall()
```

Each shim stashes the original `navigator`/`window` value so `uninstall()` restores it cleanly — useful in tests.

### Subpath imports (bundle-size sensitive)

Pick just the shims you need and install them explicitly:

```ts
import { installClipboardShim } from '@ait-co/polyfill/clipboard';
import { isTossEnvironment } from '@ait-co/polyfill/detect';

installClipboardShim();
```

The package is marked `"sideEffects": false`, so unused shims are dropped by any modern bundler when you use subpath imports.

## Supported APIs

모든 Tier 1 shim이 단위 테스트까지 통과한 상태이고, 실환경 검증(`sdk-example` 통합)이 남아있습니다. 실환경 검증 이후 일부 API 매핑이 조정될 수 있습니다.

| Web standard | SDK counterpart | Landed in |
|---|---|---|
| `navigator.clipboard.readText()` / `writeText(text)` | `getClipboardText()` / `setClipboardText(text)` | 0.1.0 |
| `navigator.geolocation.getCurrentPosition()` | `getCurrentLocation({ accuracy })` | 0.1.1 (pending) |
| `navigator.geolocation.watchPosition()` / `clearWatch()` | `startUpdateLocation(...)` | 0.1.1 (pending) |
| `navigator.share({ title, text, url })` | `share({ message })` (concatenates into `message`) | 0.1.1 (pending) |
| `navigator.vibrate(pattern)` | `generateHapticFeedback(...)` (best-effort, lossy) | 0.1.1 (pending) |
| `navigator.onLine` / `navigator.connection.effectiveType` | `getNetworkStatus()` (poll on read; no `change` for seed) | 0.1.1 (pending) |

See [`TODO.md`](./TODO.md) for the full backlog and tiering.

APIs without a reasonable Web standard counterpart (auth, IAP, ads, analytics, Toss-specific environment info) stay in the `@apps-in-toss/web-framework` namespace — polyfill is not the home for "everything the SDK does." Rationale in [`CLAUDE.md`](./CLAUDE.md).

## License

BSD-3-Clause
