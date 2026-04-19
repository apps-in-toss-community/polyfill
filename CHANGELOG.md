# @ait-co/polyfill

## 0.1.1

### Patch Changes

- 236887d: Initial scaffold: runtime Apps in Toss environment detection (`isTossEnvironment`), a reference `navigator.clipboard` shim that routes `readText` / `writeText` through `@apps-in-toss/web-framework` when detected and falls through to the browser's native clipboard otherwise, and `install()` / `uninstall()` entry points.
- 6285999: Tier 1 표준 Web API shim 추가: `navigator.geolocation`(`getCurrentPosition` / `watchPosition` / `clearWatch`), `navigator.share`, `navigator.vibrate`, `navigator.onLine` + `navigator.connection`. 각 shim은 clipboard와 동일한 install/uninstall 패턴과 서브패스 export(`@ait-co/polyfill/geolocation` 등)를 제공하며, Apps in Toss 환경에서는 SDK(`getCurrentLocation` / `startUpdateLocation` / `share` / `generateHapticFeedback` / `getNetworkStatus`)로 라우팅하고 그 외 환경에서는 브라우저 원본으로 fall-through 한다.

  주요 동작 세부사항:

  - `clearWatch(id)`가 async subscribe 완료 전에 호출되어도 SDK 구독을 leak 하지 않는다 (cancel-flag race 보호).
  - `GeolocationPositionError`는 실제 브라우저에서 `instanceof` 가 동작하도록 prototype을 세팅해서 반환.
  - `navigator.share({...})` 가 SDK 에러를 거부할 때 `DOMException('AbortError')`로 래핑하며 원본은 `.cause`로 보존.
  - `navigator.connection`의 `change` 이벤트는 실제 상태 전환(예: WIFI → OFFLINE)에만 발생 — 최초 seed의 `null → X` 학습은 이벤트를 발생시키지 않음.
  - 모든 shim은 uninstall 시 instance-level override만 `delete`하여 prototype getter가 다시 노출되도록 한다 (실 브라우저의 non-configurable prototype descriptor 대응). clipboard shim도 같은 패턴으로 정리됨.
  - `navigator.vibrate(0)` / `vibrate([])`은 브라우저에 pass-through되어 spec의 "cancel pending vibration" 의미를 보존 (Toss 모드에서는 SDK cancel API가 없어 no-op).
  - 브라우저 모드에서 `navigator.connection`은 브라우저 네이티브 NetworkInformation 객체를 그대로 반환 (shim이 자체 default로 shadow 하지 않음). Toss seed 전에도 동일하게 네이티브로 fall-through.
