# CLAUDE.md

`apps-in-toss-community`는 비공식(unofficial) 오픈소스 커뮤니티다. 토스 팀과 제휴 없음. 산출물에서 "공식(official)", "토스가 제공하는", "powered by Toss" 등 제휴·후원·인증 암시 표현을 쓰지 않는다 — 대신 "커뮤니티/오픈소스/비공식"을 쓴다. 상세는 umbrella `../CLAUDE.md`의 "프로젝트 성격" 참조.

## 프로젝트 개요

**@ait-co/polyfill** — 앱인토스 독점 SDK(`@apps-in-toss/web-framework`) 대신 **표준 Web API**(`navigator.clipboard`, `navigator.geolocation` 등)로 미니앱을 작성할 수 있게 해주는 투명한 어댑터 레이어. 개발자는 `navigator.clipboard.writeText(...)`만 쓰고, polyfill이 런타임에 앱인토스 환경을 감지해 SDK 호출로 변환한다. 토스 환경이 아니면 브라우저 원본을 그대로 사용 (no-op shim 아님).

### 설계 원칙

1. **표준이 먼저.** polyfill은 *환경 어댑터*이지 새로운 API surface가 아니다.
2. **No-op 금지.** 토스가 아니면 브라우저 원본으로 fall-through. 브라우저도 미지원이면 표준 에러(`NotAllowedError` 등)를 그대로 surface — 조용히 삼키지 않는다.
3. **Tree-shakable.** 각 shim은 독립 모듈. `install()` 외에 per-API entry(`@ait-co/polyfill/clipboard`)도 제공.
4. **Small surface.** 표준 Web API에 *합리적으로* 1:1 대응되는 것만 polyfill. 나머지(IAP, TossPay, AppLogin, Ads 등)는 SDK namespace에 남긴다.
5. **`@apps-in-toss/web-framework`는 optional peer dep.** 순수 웹 컨텍스트로 가져와도 동작.

## 아키텍처

### Entry-point 전략

두 레이어:

1. **`import { install, uninstall } from '@ait-co/polyfill'`** — 기본 엔트리. 앱 entry에서 한 번 `install()` 호출로 covered API 전부 교체. `install()`은 uninstall 함수를 반환하기도 하고, top-level `uninstall()`도 가능.
2. **Per-API 서브패스** — `import { installClipboardShim } from '@ait-co/polyfill/clipboard'` 등. 번들 크기에 민감한 소비자용. 호출자가 반환받은 installer를 직접 호출.

**중요**: 과거 "side-effect import로 auto-install"을 고려했지만 채택하지 않았다 — tree-shakability를 위해 `package.json`에 `"sideEffects": false` 선언, 설치는 **명시적**으로 `install()` 호출로 일어나게 한다. detect만 쓰고 싶을 때 clipboard shim까지 끌려오는 것을 방지.

shim 설치는 **idempotent**. 각 shim은 원본을 `Symbol`-keyed 백업에 보관 → `uninstall()`이 복원. uninstall은 **전역 단위** — 여러 번 호출해도 한 번만 효과. Top-level `install()`도 idempotent — 반복 호출은 새 일을 안 하지만 반환되는 uninstall 클로저는 여전히 전체 teardown을 수행한다.

**Prototype 프로퍼티(`navigator.onLine`, `connection`, `geolocation` 등) 처리**: 실제 브라우저에서 이들은 `Navigator.prototype`에 non-configurable getter라 **prototype을 건드리면 TypeError**. 항상 instance level에 `configurable: true` descriptor를 얹어 prototype을 가리고, uninstall 때 `delete navigator.xxx`로 instance override만 제거해서 prototype getter가 다시 드러나도록 한다. Prototype은 절대 mutate하지 않는다.

### 환경 감지 (`src/detect.ts`)

단일 `isTossEnvironment()` 함수: (1) `@apps-in-toss/web-framework` 모듈이 런타임에 존재·사용 가능한지 feature-sniff (dynamic import + try/catch). UA는 spoofable, SDK가 `window.__AIT__` 같은 전역도 노출하지 않으므로 **이게 유일하게 신뢰 가능한 신호**. (2) 첫 호출 이후 캐시. (3) Override 훅(`__AIT_POLYFILL_FORCE__` on `globalThis`) — 테스트/devtools가 ESM mock 없이 결과를 뒤집을 수 있게.

감지 중엔 **SDK 함수를 호출하지 않는다** — 모듈 로드와 알려진 export 존재만 확인. 실제 API 호출은 각 shim 내부에서 lazy하게.

### Per-shim 구조

각 shim은 `installXxxShim(): () => void` 시그니처. 원본을 보관하고 `Object.defineProperty(navigator, 'xxx', { value, configurable: true, writable: true })`로 교체, 반환되는 teardown은 `delete navigator.xxx` 후 (had && original이 다르면) 원본을 다시 defineProperty로 복원. `installAll()`이 각 shim의 uninstall을 composition.

### Build / Test

- **`tsdown`** — devtools / 조직 표준과 일치. ESM only, `target: es2022`, DTS + sourcemap.
- 진입점 다중화: `index`, `clipboard`, `detect` (per-shim도 추가됨).
- **`vitest` + jsdom**. 각 shim은 **세 경로** 테스트: (1) Toss 존재(`vi.mock`), (2) 브라우저 only, (3) 둘 다 없음 → 표준 에러 surface.

## Tier 분류 기준

표준과 SDK의 mismatch 깊이로 세 tier:

- **Tier 1 (ship first)** — 1:1에 가까운 직접 매핑. clipboard, geolocation, share, vibrate, onLine/connection.
- **Tier 2 (Tier 1 안정 후 평가)** — 의미론적 gap이 있는 것. sync/async mismatch(`localStorage` ↔ SDK `Storage`), in-app browser 정책 차이(`window.open`), nav stack 의존(`history.back`), browser가 이미 커버하는 이벤트(`visibilitychange`).
- **Out of scope** — 표준 대응이 없는 것 (아래).

우선순위는 umbrella `../TODO.md`의 `polyfill` 섹션 (Tier 1 = Medium, Tier 2 = Backlog).

## Out-of-scope (왜)

의도적으로 polyfill이 **커버하지 않는다**:

- **Auth** (`appLogin`, `getUserKeyForGame`, `appsInTossSignTossCert`) — 표준(OIDC)에 더 잘 맞고, 별도 repo `oidc-bridge` 담당.
- **Payments** (`checkoutPayment`, IAP) — 스토어/호스트 환경 종속. Web Payment Request API는 Toss 결제 semantic과 매핑 어려움.
- **Ads / Analytics** — 표준 없음. 제공자 SDK 직접 사용.
- **Toss 환경 정보** (`getTossShareLink`, `requestReview`, `getPlatformOS`, `getDeviceId`, `getLocale` 등) — Toss-specific. 표준화 시 왜곡.
- Game Center, promotions, safe-area insets, screen-awake, secure screen — 플랫폼 고유.

이들은 `@apps-in-toss/web-framework` namespace에서 직접 import. **polyfill은 "SDK가 하는 모든 것의 집"이 아니다**.

## 짝 repo

- **`devtools`** — devtools는 SDK mock(독점 API를 브라우저에서 흉내), polyfill은 반대 방향(표준 Web API를 앱인토스 환경에서 동작). 둘 다 쓰면 "표준 API로 작성 + 브라우저에서 즉시 실행". devtools unplugin에 polyfill 주입 옵션 추가 고려. **Open question**: 둘 다 설치 시 SDK가 "present(= devtools mock)"로 감지되어 polyfill이 mock을 경유하는지 — 의도된 동작이며 sdk-example integration에서 확인.
- **`sdk-example`** (downstream consumer) — polyfill 완성 후 sdk-example을 **표준 Web API 경로로 재작성**(또는 토글 옵션)해서 동작 증명. polyfill의 주요 품질 게이트.

전체 그림은 umbrella `../CLAUDE.md`의 "짝(pair) 관계" 참조.

## 기술 스택 / 명령어

조직 공통(Node 24, pnpm 10.33.0, TS strict, Biome, Changesets, pre-commit hook 등)은 umbrella `../CLAUDE.md`의 "공통 스택" 참조. repo-specific:

- **TS strict + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`**, ESM only (`"type": "module"`)
- **tsdown** 빌드, **vitest + jsdom** 테스트

핵심 명령: `pnpm dev` (watch), `pnpm build`, `pnpm typecheck`, `pnpm test`, `pnpm lint`. 전체 스크립트는 `package.json`.

## 릴리즈

버전 정책·Changesets 흐름·bump 권한은 umbrella `../CLAUDE.md` 및 `../meta/release-strategy.md` 참조. 요약: 현재 **`0.1.x` patch only**, 다음 minor 이벤트는 곧바로 `1.0.0`. Claude는 patch만 자율 생성, minor/major는 Dave 명시 지시 시.

### 로드맵

1. `0.1.0` — scaffold + clipboard shim
2. `0.1.1` — 남은 Tier 1 (geolocation + share + vibrate + network) 한 번에
3. `0.1.2+` — `sdk-example` 통합에서 드러나는 fix · API mapping 조정
4. `1.0.0` — agent-plugin ship과 coordinated, Dave의 명시적 지시 시점

## TypeScript 타입

`navigator`를 mutate하므로 consumer의 TS는 이미 올바른 타입(DOM lib)을 본다. Toss-specific extras를 별도로 노출하지 않으므로 ambient 타입 augmentation은 ship하지 않는다 — 그건 SDK의 몫.

## Tier 1 shim별 설계 결정 (ship 시점에 남긴 메모)

### clipboard
- `readText` / `writeText`만 SDK 경유. `read` / `write` (rich content)는 토스에 대응 없음 → `NotSupportedError`.
- EventTarget 메서드는 fallback 있으면 forwarding, 없으면 silently drop. SDK가 clipboard event를 emit하지 않으므로 의도적으로 lossy.

### geolocation
- `PositionOptions.enableHighAccuracy` boolean → SDK `Accuracy` enum: `true → High (4)`, `false → Balanced (3)`. `timeout` / `maximumAge`는 SDK가 받지 않으므로 무시.
- 반환 `GeolocationPosition` / `GeolocationCoordinates`는 **mutable 플레인 객체**. 실 DOM은 read-only getter지만 shim은 실용성 위해 일반 객체. 소비자 코드는 위치 정보를 mutate 하지 말 것.
- SDK `coords`에 `speed` 필드 없음 → `null` (spec상 "unknown"). `altitude` / `altitudeAccuracy` / `heading`은 직접 전달.
- `watchPosition`이 반환하는 numeric watch id는 shim 내부 카운터. SDK `startUpdateLocation`은 `unsubscribe` 클로저 반환 → id → unsubscribe Map. `clearWatch(id)`가 적절한 쪽(`sdkWatches` 또는 `nativeWatches`) 조회해 정리.
- `startUpdateLocation`은 `timeInterval` / `distanceInterval` 요구하지만 web `watchPosition`엔 대응 없음. 기본값 `timeInterval: 1000`, `distanceInterval: 0`로 고정 — 세밀히 제어하려면 SDK 직접 사용.

### share
- SDK `share`는 단일 `message: string`만 받음. `title` / `text` / `url`을 `\n`로 연결해 단일 메시지로 합성. 소비자는 파싱 가능한 markdown 링크 같은 구조를 기대하지 말 것.
- 빈 `ShareData`({})는 `TypeError`.
- `canShare({ files })`는 Toss 모드에서 `false`. Browser 모드는 native `canShare`에 위임.

### vibrate (best-effort, 의도적으로 lossy)
- Web `navigator.vibrate`는 sync에 boolean 반환, SDK `generateHapticFeedback`은 async Promise. 완전한 화해 불가. trade-off:
  - shim은 항상 `true` sync 반환 (fire-and-forget).
  - SDK 호출 실패는 삼킨다(spec의 `vibrate`는 에러 surface 경로 없음).
- Duration → haptic type: `< 40ms` → `tickWeak`, `≥ 40ms` → `basicMedium`. 배열 패턴: 짝수 index만 "on"으로 보고 `tap` 반복, 홀수 index는 `setTimeout` 지연.
- 40ms 문턱값은 임의 heuristic — Android `HapticFeedbackConstants` / iOS `UIImpactFeedbackGenerator`가 모두 qualitative라 ms 단위로 정답이 없다. 정확한 vibration 패턴 reproduction은 불가 — 문서화된 best-effort.
- 왜 ship: mini-app UI가 `navigator.vibrate`를 조건부로 호출하는 패턴이 흔하고, 완전히 dropping하면 토스 내에서 무감각한 UX가 된다.

### network
- SDK `getNetworkStatus()`는 one-shot async, web `navigator.onLine`은 sync getter. Gap을 메우는 방식:
  - install 시 `getNetworkStatus()`를 non-blocking 호출로 cache seed.
  - 이후 read마다 background refresh + cached value 반환. 첫 read 전엔 native value (jsdom 기본 `true`) fallback.
  - `change` 이벤트는 **합성하지 않는다**. 전환 감지 필요하면 소비자가 polling.
- `WIFI` / `WWAN` / `UNKNOWN` → `effectiveType: '4g'`.
- `type`(비표준): `WIFI → 'wifi'`, cellular group → `'cellular'`, `OFFLINE → 'none'`.

## 현재 Status

Tier 1 전부 구현: clipboard · geolocation · share · vibrate · network. 다음은 `sdk-example` 통합을 통한 실환경 검증. 전체 로드맵은 [landing page](https://apps-in-toss-community.github.io/).
