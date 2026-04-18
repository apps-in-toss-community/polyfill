# CLAUDE.md

## 프로젝트 성격 (중요)

**`apps-in-toss-community`는 비공식(unofficial) 오픈소스 커뮤니티다.** 토스 팀과 제휴 없음. 사용자에게 보이는 산출물에서 "공식/official/토스가 제공하는/powered by Toss" 등 제휴·후원·인증 암시 표현을 **쓰지 않는다**. 대신 "커뮤니티/오픈소스/비공식"을 사용한다. 의심스러우면 빼라.

## 짝 repo

- **`devtools`** — devtools는 SDK mock (앱인토스 독점 API를 브라우저에서 흉내), polyfill은 반대 방향(표준 Web API를 앱인토스 환경에서 동작시킴). 둘 다 쓰면 "표준 Web API로 작성 + 브라우저에서 즉시 실행"이 된다. devtools unplugin에 polyfill 주입 옵션을 추가하는 방향 고려.
- **`agent-plugin`** — `/ait new` 시 "표준 API 모드"로 스캐폴딩 옵션 제공 (polyfill 자동 설정).

## 프로젝트 개요

**@ait-co/polyfill** — 앱인토스 독점 SDK(`@apps-in-toss/web-framework`) 대신 **표준 Web API**(`navigator.clipboard`, `navigator.geolocation`, `window.localStorage` 등)를 그대로 사용해서 미니앱을 작성할 수 있게 해주는 투명한 어댑터 레이어.

### 설계 원칙

- **표준이 먼저**. 개발자는 `navigator.clipboard.writeText(...)`만 쓰고, polyfill이 런타임에 앱인토스 환경을 감지해 내부적으로 SDK 호출로 변환.
- **토스 환경이 아닌 경우** 브라우저의 원본 구현을 그대로 사용 (no-op shim 아님).
- 가능하면 **tree-shakable**하게 — 사용자가 쓴 API만 번들에 포함되도록.

## Status

placeholder 상태. 구현 전.

전체 로드맵은 [landing page](https://apps-in-toss-community.github.io/) 참고.
