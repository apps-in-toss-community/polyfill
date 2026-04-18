# CLAUDE.md

## 프로젝트 성격 (중요)

**`apps-in-toss-community`는 비공식(unofficial) 오픈소스 커뮤니티다.** 토스 팀과 제휴 없음. 사용자에게 보이는 산출물에서 "공식/official/토스가 제공하는/powered by Toss" 등 제휴·후원·인증 암시 표현을 **쓰지 않는다**. 대신 "커뮤니티/오픈소스/비공식"을 사용한다. 의심스러우면 빼라.

## 프로젝트 개요

**@ait-co/polyfill** — 앱인토스 독점 SDK(`@apps-in-toss/web-framework`) 대신 **표준 Web API**(`navigator.clipboard`, `navigator.geolocation`, `window.localStorage` 등)를 그대로 사용해서 미니앱을 작성할 수 있게 해주는 투명한 어댑터 레이어.

개발자는 `navigator.clipboard.writeText(...)`만 쓰고, polyfill이 런타임에 앱인토스 환경을 감지해 내부적으로 SDK 호출로 변환한다. 토스 환경이 아니면 브라우저의 원본 구현을 그대로 사용한다 (no-op shim이 아님).

### 설계 원칙

1. **표준이 먼저.** polyfill은 *환경 어댑터*이지 새로운 API surface가 아니다.
2. **No-op 금지.** 토스가 아니면 브라우저 원본으로 fall-through. 브라우저도 지원 안 하면 표준 에러(`NotAllowedError` 등)를 그대로 surface — 조용히 삼키지 않는다.
3. **Tree-shakable.** 각 shim은 독립 모듈. `install()` 외에도 per-API entry(`@ait-co/polyfill/clipboard`)를 제공.
4. **Small surface.** 표준 Web API에 *합리적으로* 1:1로 대응되는 것만 polyfill. 대응 없는 것(IAP, TossPay, AppLogin, Ads, Analytics, Game Center 등)은 SDK namespace에 남긴다.
5. **`@apps-in-toss/web-framework`는 optional peer dep.** 순수 웹 컨텍스트로 가져와도 동작(브라우저 native로 fall-through).

## 아키텍처

### Entry-point 전략

두 레이어:

1. **`import { install, uninstall } from '@ait-co/polyfill'`** — 기본 엔트리. 앱 entry에서 한 번 `install()`을 호출해 covered API를 전부 교체. **대부분의 앱 작성자가 쓸 형태.** `install()`은 uninstall 함수를 반환하기도 하고, top-level `uninstall()`을 바로 호출해도 된다.
2. **Per-API 서브패스** — `import { installClipboardShim } from '@ait-co/polyfill/clipboard'` 등. 번들 크기에 민감한 소비자가 하나/둘만 쓰고 싶을 때. 호출자가 반환받은 installer를 직접 호출한다.

**중요**: 과거 "side-effect `import '@ait-co/polyfill'`로 auto-install"을 고려했지만 채택하지 않았다 — tree-shakability를 위해 `package.json`에 `"sideEffects": false`를 선언하고, 설치는 **명시적으로** `install()` 호출로 일어나게 한다. consumer가 detect만 쓰고 싶을 때 clipboard shim까지 끌려 들어오는 것을 방지.

shim 설치는 **idempotent**. 재호출해도 첫 호출 이후엔 no-op. 각 shim은 원본 `navigator.clipboard`/etc.를 `Symbol`-keyed 백업에 보관 → `uninstall()`이 복원 (테스트·고급 consumer용). uninstall은 **전역 단위** — 여러 번 호출해도 어느 한 번만 효과가 있고 나머지는 no-op.

### 환경 감지 (`src/detect.ts`)

단일 `isTossEnvironment()` 함수:

1. `@apps-in-toss/web-framework` 모듈이 런타임에 존재하고 사용 가능한지 feature-sniff (dynamic import + try/catch). UA 문자열은 spoofable하고 SDK 자체가 `window.__AIT__` 같은 전역을 노출하지 않으므로 **이게 유일하게 신뢰 가능한 신호**.
2. 첫 호출 이후 결과는 캐시.
3. Override 훅(`__AIT_POLYFILL_FORCE__` on `globalThis`) — 테스트/devtools가 ESM mock 없이 결과를 뒤집을 수 있게.

감지 중엔 **SDK 함수를 호출하지 않는다** — 모듈 로드와 잘 알려진 export(`getClipboardText` 등) 존재만 확인. 실제 API 호출은 각 shim 내부에서 lazy하게.

### Per-shim 구조

```ts
// src/shims/clipboard.ts
export function installClipboardShim(): () => void {
  const original = navigator.clipboard;
  // replacement: Toss면 SDK 경유, 아니면 original로 fall-through
  Object.defineProperty(navigator, 'clipboard', { value: replacement, configurable: true });
  return () => Object.defineProperty(navigator, 'clipboard', { value: original, configurable: true });
}
```

각 shim이 **uninstall 함수를 반환** → `installAll()`이 composition.

### Build / Test

- **`tsdown`** — devtools / org 표준과 일치.
- **ESM only** (Node 24, 모던 번들러). CJS는 consumer 요청 시 추가.
- 진입점 다중화: `index`, `clipboard`, `detect`. `target: es2022`, DTS + sourcemap.
- **`vitest` + jsdom** (devtools와 parity). 각 shim은 **세 경로**를 테스트: (1) Toss 존재(`vi.mock`), (2) 브라우저 only, (3) 둘 다 없음 → 표준 에러 surface.

## Tier 분류 기준

Polyfill에 올릴 후보 API를 세 tier로 나눈다. 기준은 **"표준과 SDK의 mismatch가 얼마나 깊은가"**.

- **Tier 1 (ship first)** — 1:1에 가까운 직접 매핑. permission model이나 return shape가 다른 정도는 converter로 흡수 가능. clipboard, geolocation, share, vibrate, onLine/connection이 여기.
- **Tier 2 (evaluate after Tier 1 stabilises)** — 의미론적 gap이 있어 shim이 문제를 만들 여지가 있는 것. sync/async mismatch(`localStorage` ↔ SDK `Storage`), in-app browser 정책 차이(`window.open`), nav stack 의존(`history.back`), browser가 이미 커버하는 이벤트(`visibilitychange`). 배포 전 policy 결정 필요.
- **Out of scope** — 표준 대응이 없는 것(아래 참고).

우선순위 관리는 `TODO.md` 참고 — Tier 1 = Medium, Tier 2 = Backlog로 매핑.

## Out-of-scope (왜)

아래는 의도적으로 polyfill이 **커버하지 않는다**:

- **Auth** (`appLogin`, `getUserKeyForGame`, `appsInTossSignTossCert`) — 표준(OIDC)에 더 잘 맞고, 별도 repo `oidc-bridge`가 담당.
- **Payments** (`checkoutPayment`, IAP) — 결제는 스토어/호스트 환경에 종속. Web Payment Request API는 Toss 결제 semantic과 매핑이 어렵다.
- **Ads** (`GoogleAdMob`, `TossAds`) — 표준 없음.
- **Analytics** (`Analytics`, `eventLog`, `tdsEvent`) — 표준 없음. 제공자 SDK를 직접 쓰는 게 정상.
- **Toss 환경 정보** (`getTossShareLink`, `requestReview`, `getPlatformOS`, `getOperationalEnvironment`, `getTossAppVersion`, `getDeviceId`, `getLocale` 등) — Toss-specific. 표준화 시도 시 왜곡된다.
- Game Center, promotions, safe-area insets, screen-awake, secure screen — 플랫폼 고유.

이들은 `@apps-in-toss/web-framework` namespace에서 직접 import해서 쓴다. **polyfill은 "SDK가 하는 모든 것의 집"이 아니다**는 원칙을 유지한다.

## 짝 repo

- **`devtools`** — devtools는 SDK mock(앱인토스 독점 API를 브라우저에서 흉내), polyfill은 반대 방향(표준 Web API를 앱인토스 환경에서 동작시킴). 둘 다 쓰면 "표준 Web API로 작성 + 브라우저에서 즉시 실행"이 된다. devtools unplugin에 polyfill 주입 옵션을 추가하는 방향 고려. **Open question**: 둘 다 설치했을 때 SDK가 "present(= devtools mock)"로 감지되어 polyfill이 mock을 경유하는지 — 의도된 동작이며, sdk-example integration에서 확인한다.
- **`sdk-example`** (downstream consumer) — polyfill이 완성되면 sdk-example을 **표준 Web API 경로로 재작성**(또는 토글 옵션 추가)해서 실제 동작을 증명한다. 이게 polyfill의 주요 품질 게이트.
- **`agent-plugin`** — `/ait new` 시 "표준 API 모드"로 스캐폴딩 옵션 제공 (polyfill 자동 설정).

## 기술 스택

- **TypeScript** (ESM only, `"type": "module"`, strict + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`)
- **tsdown** — 빌드
- **vitest** — 테스트 (jsdom env)
- **pnpm** — 패키지 매니저 (10.33.0)
- **Biome** — lint + formatter (조직 표준, `noExplicitAny: error`; 불가피한 경우 `biome-ignore` + 사유)
- **Changesets** — 릴리즈 관리 (Type A: npm publish)

## 명령어

```bash
pnpm build          # tsdown으로 dist/ 빌드
pnpm dev            # watch 모드
pnpm typecheck      # tsc --noEmit
pnpm test           # vitest run
pnpm lint           # biome check .
pnpm lint:fix       # biome check --write .
pnpm format         # biome format --write .
```

## 릴리즈

버전 정책·Changesets 흐름·Claude의 bump 권한은 umbrella `../CLAUDE.md`의 "배포 전략" 섹션과 `agent-plugin/shared/skills/changeset/SKILL.md` 참고.

- 현재는 **`0.1.x` patch only** 구간. `minor`(0.2.0) 진입 금지 — 다음 minor 이벤트는 곧바로 `1.0.0`.
- Claude는 기본적으로 **patch만** 자율 생성. `minor`/`major`는 Dave가 명시적으로 지시할 때만.
- Changesets → `changesets/action` → npm publish (기 bootstrapped release workflow 재사용).
- 첫 `1.0.0`은 agent-plugin 통합 완료 시점에 Dave의 명시적 지시로 릴리즈.

### 로드맵

1. scaffold + clipboard shim — `0.1.0` (현재)
2. geolocation + network status — `0.1.1`
3. share + vibrate — `0.1.2`
4. sdk-example 통합 — 브라우저(+ devtools)와 실제 토스 환경 양쪽에서 `navigator.clipboard.writeText()` 경로 동작 확인
5. `1.0.0` — agent-plugin ship과 coordinated. Dave의 명시적 지시 시점.

## TypeScript 타입

polyfill이 `navigator`를 mutate하므로 consumer의 TS는 이미 올바른 타입(DOM lib)을 본다. Toss-specific extras를 별도로 노출하지 않으므로 ambient 타입 augmentation은 ship하지 않는다 — 그건 SDK의 몫.

## Status

scaffold 완료. `src/shims/clipboard.ts`만 구현, 나머지는 `TODO.md` 참고. 전체 로드맵은 [landing page](https://apps-in-toss-community.github.io/).
