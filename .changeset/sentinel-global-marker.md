---
"@ait-co/polyfill": patch
---

`globalThis.__AIT_POLYFILL__` sentinel 노출 — devtools가 polyfill 로드 여부 및 버전을 감지할 수 있도록 read-only(writable/enumerable/configurable: false) 플래그를 설정합니다. 네트워크 호출 없음. 패키지 버전(공개 정보)과 `loaded: true` 플래그만 포함합니다.

Exposes a `globalThis.__AIT_POLYFILL__` sentinel — a read-only (writable/enumerable/configurable: false) marker so the devtools companion can detect polyfill presence and version. No network call is made; the sentinel contains only the public package version and a `loaded: true` flag.
