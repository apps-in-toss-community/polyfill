# @ait-co/polyfill

> 🚧 **Work in Progress** — not yet published.
> 아직 개발 중입니다. 릴리스 전입니다.

Web standard API polyfill for [Apps in Toss](https://toss.im/) mini-apps.

앱인토스 미니앱에서 **웹 표준 API를 그대로 사용**해서 개발할 수 있게 해주는 polyfill 라이브러리.

## Goal / 목표

`@apps-in-toss/web-framework`의 전용 SDK API 대신, 브라우저/Node 표준 API (`navigator.clipboard`, `navigator.geolocation`, `window.localStorage` 등)를 그대로 사용해도 앱인토스 환경에서 동작하도록 해주는 투명한 어댑터 레이어.

Instead of using `@apps-in-toss/web-framework`'s proprietary APIs, write your mini-app with standard Web APIs (`navigator.clipboard`, `navigator.geolocation`, `window.localStorage`, etc.) and have them transparently work inside Apps in Toss.

## Status

See the [organization landing page](https://apps-in-toss-community.github.io/) for the full roadmap.
