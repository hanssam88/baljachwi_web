# 발자취 웹 (baljachwi-web)

사진의 GPS·촬영시간 EXIF를 **기기 안에서만** 읽어 ① 한국 시군구/시도 등고선 지도와 ② 여행 경로 지도를 그리는 웹 앱. iOS 앱 [`baljachwi`](https://github.com/hanssam88/baljachwi)의 웹 포트이며, 코어 알고리즘(`BaljachwiCore`)을 TypeScript로 byte-faithful 이식한다. **사진·위치 데이터는 업로드되지 않는다.**

## 기술 스택

- **Next.js**(App Router) · React · TypeScript — 클라이언트 SPA(서버 라우트 없음)
- **Dexie**(IndexedDB) 영속화 + JSON 백업
- **Web Worker** — 12MB 매칭 GeoJSON 파싱 + 점-다각형 매칭
- **exifr** 브라우저 EXIF 파싱 · **MapLibre GL** 경로지도 · 사전생성 SVG path 등고선

## 개발

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # Vitest (core 골든 / data / components)
npm run e2e          # Playwright (사전 1회: npx playwright install chromium)
npm run build        # 프로덕션 빌드
```

## Geo 데이터 준비

매칭/표시용 GeoJSON 과 사전생성 SVG path 는 iOS 코어 번들에서 가져온다. iOS 클론 경로를 `BALJACHWI_IOS_ROOT`(기본 `../baljachwi`)로 지정:

```bash
BALJACHWI_IOS_ROOT=../baljachwi npm run copy-geo        # public/geo/*.geojson
BALJACHWI_IOS_ROOT=../baljachwi npm run gen-choropleth  # public/geo/korea-*.paths.json
```

## 구조

```
src/core/        BaljachwiCore의 순수 TS 포트(No React/DOM/IO) — 골든 테스트로 충실성 보장
src/data/        Dexie db/repo/reconcile/backup (단일 writer)
src/worker/      scan.worker — geojson 파싱 + ScanPipeline
src/lib/         exif · filePick · thumbnail · tokens
src/components/  region/* · trip/* · shared/* · RootTabs · ImportOnboarding
src/app/         layout · page (클라이언트 SPA)
scripts/         copy-geo · gen-choropleth
tests/           core(골든) · data(fake-indexeddb) · components(RTL) · e2e(Playwright)
docs/specs/      설계 스펙
```

## 설계 스펙

[`docs/specs/2026-06-10-web-port-design.md`](docs/specs/2026-06-10-web-port-design.md)
