---
'@ait-co/polyfill': patch
---

Tier 1 표준 Web API shim 추가: `navigator.geolocation`(`getCurrentPosition` / `watchPosition` / `clearWatch`), `navigator.share`, `navigator.vibrate`, `navigator.onLine` + `navigator.connection`. 각 shim은 clipboard와 동일한 install/uninstall 패턴과 서브패스 export(`@ait-co/polyfill/geolocation` 등)를 제공하며, Apps in Toss 환경에서는 SDK(`getCurrentLocation` / `startUpdateLocation` / `share` / `generateHapticFeedback` / `getNetworkStatus`)로 라우팅하고 그 외 환경에서는 브라우저 원본으로 fall-through 한다.
