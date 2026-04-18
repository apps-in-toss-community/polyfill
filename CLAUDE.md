# CLAUDE.md

## 프로젝트 성격 (중요)

**`apps-in-toss-community`는 비공식(unofficial) 오픈소스 커뮤니티다.** 토스 팀과 제휴 없음. 사용자에게 보이는 산출물에서 "공식/official/토스가 제공하는/powered by Toss" 등 제휴·후원·인증 암시 표현을 **쓰지 않는다**. 대신 "커뮤니티/오픈소스/비공식"을 사용한다. 의심스러우면 빼라.

## 짝 repo

- **`sdk-example`** (downstream consumer) — polyfill이 완성되면 sdk-example을 **표준 Web API 경로로 재작성**(또는 토글 옵션 추가)해서 실제 동작을 증명한다. 이게 polyfill의 주요 품질 게이트.
- **`devtools`** — devtools는 SDK mock (앱인토스 독점 API를 브라우저에서 흉내), polyfill은 반대 방향(표준 Web API를 앱인토스 환경에서 동작시킴). 둘 다 쓰면 "표준 Web API로 작성 + 브라우저에서 즉시 실행"이 된다. devtools unplugin에 polyfill 주입 옵션을 추가하는 방향 고려.
- **`agent-plugin`** — `/ait new` 시 "표준 API 모드"로 스캐폴딩 옵션 제공 (polyfill 자동 설정).

## 프로젝트 개요

**@ait-co/polyfill** — 앱인토스 독점 SDK(`@apps-in-toss/web-framework`) 대신 **표준 Web API**(`navigator.clipboard`, `navigator.geolocation`, `window.localStorage` 등)를 그대로 사용해서 미니앱을 작성할 수 있게 해주는 투명한 어댑터 레이어.

### 설계 원칙

- **표준이 먼저**. 개발자는 `navigator.clipboard.writeText(...)`만 쓰고, polyfill이 런타임에 앱인토스 환경을 감지해 내부적으로 SDK 호출로 변환.
- **토스 환경이 아닌 경우** 브라우저의 원본 구현을 그대로 사용 (no-op shim 아님).
- 가능하면 **tree-shakable**하게 — 사용자가 쓴 API만 번들에 포함되도록.

## 기술 스택

- **TypeScript** (ESM only, `"type": "module"`, strict + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`)
- **tsdown** — 빌드
- **vitest** — 테스트
- **pnpm** — 패키지 매니저 (10.33.0)
- **Biome** — lint + formatter (조직 표준)
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

현재는 **`0.1.x` patch only** 구간. 첫 `1.0.0` 릴리즈는 agent-plugin 통합 완료 시점에 Dave의 명시적 지시가 있을 때.

## Status

scaffold 완료, 구현 전. `src/index.ts`는 placeholder.

전체 로드맵은 [landing page](https://apps-in-toss-community.github.io/) 참고.
