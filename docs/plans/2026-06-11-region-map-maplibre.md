# 지역지도 MapLibre 포팅 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (또는 subagent-driven-development)으로 task별 구현. 각 단계는 `- [ ]` 체크박스로 추적.

**Goal:** 지역지도(현 SVG choropleth)를 경로지도(TripMapView)와 동일한 MapLibre 포맷으로 교체한다 — 실제 OpenFreeMap 타일 basemap 위에 시군구/시도를 방문상태에 따라 반투명 색칠하고, 네이티브 핀치/팬 + 지역명 라벨 + 정복률/토글/범례를 유지한다.

**Architecture:** 지역 폴리곤은 런타임에 `/geo/{level}_display.geojson`(lng/lat, 이미 존재)을 MapLibre GeoJSON 소스로 로드한다. 방문상태 색칠은 `promoteId`(지역코드)+`feature-state`로 코드별 상태를 주입하고 data-driven `fill-color` match 식으로 칠한다(소스 재로드 없이 색만 갱신). 라벨은 `symbol` 레이어(네이티브 충돌 제거=줌인 시 점진 노출)로, 한글은 `localIdeographFontFamily`로 로컬 폰트 렌더. 타일 동의 고지는 경로지도와 **동일 키를 공유**하도록 공용 모듈로 추출한다. MapLibre 통합부는 jsdom 테스트 불가이므로(코드베이스 관례) 순수 빌더(레벨 설정·색 식·동의 로직)만 TDD하고 컴포넌트는 브라우저 수동 검증한다.

**Tech Stack:** Next.js 15 / React 19 / TypeScript, maplibre-gl ^5.24.0(이미 의존성), OpenFreeMap positron 스타일, Vitest(순수 helper 단위).

---

## Context

사용자 수정 요청: "경로지도 포맷이 정확히 원하는 포맷 → 지역지도를 경로지도와 동일하게."

명확화 확정(2026-06-11, 전부 추천안):
1. **반투명 색칠 오버레이** — 실제 지도 위에 방문/가고싶음/미방문 색을 반투명 fill로(정복맵 의미 유지).
2. **경로지도와 동일** — OpenFreeMap 실제 타일 + 동일 동의 고지(지역탭이 외부 호출하게 됨, 현재 완전 오프라인에서 변경. 사용자 승인됨).
3. **기존 SVG 라벨/핀치 작업(feat/sigungu-labels-pinch-zoom) 폐기** — main 미병합. 본 작업은 **main에서 분기**(`feat/region-map-maplibre`).
4. **유지 구성요소**: 시군구/시도 토글, 정복률(%) 헤더, 색상 범례, 지역명 라벨.
5. **읽기 전용**(지역 탭해서 방문 표시하는 기능은 본 범위 외).

### 검증된 사실(구현 전 실측)

- 표시용 데이터: `public/geo/sigungu_display.geojson`(3.1MB, 255, props `{sgg, sggnm, sido, sidonm}`), `public/geo/sido_display.geojson`(1.5MB, 17, props `{sido, sidonm}`) — **lng/lat(EPSG:4326), MapLibre 직접 호환**. `/public/geo/*`는 gitignore(런타임 fetch, 커밋 불필요 — 현 paths.json과 동일).
- 토큰: `--st-visited #3A9D6B`, `--st-want #E0982E`, `--st-unvisited #DDDDE3`, `--separator`, `--label`, `--surface`(다크모드 변형 존재) → getComputedStyle 런타임 주입.
- `RootTabs`는 활성 탭만 렌더(기본 region), 사진 없으면 온보딩 → `RootTabs.test`/`region.test`에서 RegionMapView 미마운트. `region.test`는 `Choropleth`를 직접 렌더 → **Choropleth.tsx 파일을 남겨두면 무손상**.
- `TripListScreen`은 `next/dynamic(ssr:false)`로 TripMapView 지연 로드. 동일 패턴 적용.
- 타일 동의: `TILE_NOTICE_KEY='baljachwi-tile-notice-ack'`, positron `STYLE_URL='https://tiles.openfreemap.org/styles/positron'`.

## File Structure

- **생성** `src/components/map/tileConsent.ts` — 외부 타일 동의 순수 로직(경로/지역 공유). 테스트 대상.
- **생성** `src/components/map/TileNotice.tsx` — 동의 고지 모달 UI(공용, 프레젠테이션).
- **생성** `src/lib/regionLayerStyle.ts` — 레벨별 레이어 설정 + fill-color 식 + 색 검증(순수 부분 테스트 대상) + resolveStateColors(DOM, 테스트 제외).
- **생성** `src/components/region/RegionMapView.tsx` — MapLibre 지역지도(동의 게이트+타일+색칠+라벨+카메라). 브라우저 수동 검증.
- **수정** `src/components/trip/TripMapView.tsx` — 인라인 동의 로직을 공용 모듈로 치환(동작 보존 리팩토링).
- **수정** `src/components/region/RegionMapScreen.tsx` — Choropleth/paths.json 제거, RegionMapView(dynamic) 사용. 토글/헤더/범례 유지.
- **테스트** `tests/components/tileConsent.test.ts`, `tests/lib/regionLayerStyle.test.ts`.

**남겨두는(미변경) 자산**: `Choropleth.tsx`·`mapViewport.ts`(골든 290건)·`mapProjection.ts`·`gen-choropleth.mjs`·`korea-*.paths.json`은 본 작업 후 미사용이 되지만 **삭제하지 않는다**(테스트 무손상 + 삭제는 사용자 확인 필요). 미사용 정리는 후속 `docs/todos`로 이관·확인.

---

## Task 1: 공용 타일 동의 모듈 추출 + TripMapView 리팩토링

**Files:**
- Create: `src/components/map/tileConsent.ts`
- Create: `src/components/map/TileNotice.tsx`
- Modify: `src/components/trip/TripMapView.tsx`
- Test: `tests/components/tileConsent.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```ts
// tests/components/tileConsent.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { hasTileConsent, setTileConsent, TILE_NOTICE_KEY } from '@/components/map/tileConsent';

describe('tileConsent', () => {
  beforeEach(() => localStorage.clear());

  it('미동의 기본은 false', () => {
    expect(hasTileConsent()).toBe(false);
  });
  it('setTileConsent 후 true + 키에 값 저장', () => {
    setTileConsent();
    expect(localStorage.getItem(TILE_NOTICE_KEY)).toBeTruthy();
    expect(hasTileConsent()).toBe(true);
  });
  it('기존 값(임의 truthy)도 동의로 인정(하위호환)', () => {
    localStorage.setItem(TILE_NOTICE_KEY, '1');
    expect(hasTileConsent()).toBe(true);
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `npm test -- tileConsent` → FAIL(module not found)

- [ ] **Step 3: tileConsent.ts 구현**

```ts
// src/components/map/tileConsent.ts — 외부 타일 동의(경로/지역지도 공유). 순수 로직(테스트 대상).
// 두 지도 모두 같은 키를 공유 → 한 번 동의하면 양쪽에 적용.

export const TILE_NOTICE_KEY = 'baljachwi-tile-notice-ack';

export function hasTileConsent(): boolean {
  return typeof localStorage !== 'undefined' && !!localStorage.getItem(TILE_NOTICE_KEY);
}

export function setTileConsent(): void {
  if (typeof localStorage !== 'undefined') localStorage.setItem(TILE_NOTICE_KEY, '1');
}
```

- [ ] **Step 4: TileNotice.tsx 구현**(TripMapView의 모달 JSX·스타일을 그대로 이전)

```tsx
'use client';
// src/components/map/TileNotice.tsx — 외부 타일 동의 고지 모달(경로/지역지도 공용).

import type { CSSProperties } from 'react';

export function TileNotice({ onAccept }: { onAccept: () => void }) {
  return (
    <div style={overlay} role="dialog" aria-label="외부 타일 고지">
      <div style={card}>
        <p style={text}>
          지도 타일을 외부 서버(OpenFreeMap)에서 불러오므로, 보고 있는 지역의 대략적
          위치가 타일 서버에 전달될 수 있습니다. 사진 파일·정확한 GPS 좌표·식별자는
          전송되지 않습니다.
        </p>
        <button type="button" style={btn} onClick={onAccept}>
          확인
        </button>
      </div>
    </div>
  );
}

const overlay: CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(0,0,0,0.35)',
  padding: 'var(--space-5)',
};
const card: CSSProperties = {
  maxWidth: 320,
  background: 'var(--surface)',
  borderRadius: 'var(--radius-lg)',
  padding: 'var(--space-5)',
  textAlign: 'center',
};
const text: CSSProperties = { margin: 0, fontSize: 15, lineHeight: 1.5, color: 'var(--label)' };
const btn: CSSProperties = {
  marginTop: 'var(--space-4)',
  padding: '8px 24px',
  border: 'none',
  borderRadius: 'var(--radius-md)',
  background: 'var(--accent)',
  color: '#fff',
  fontSize: 15,
  fontWeight: 600,
  cursor: 'pointer',
};
```

- [ ] **Step 5: TripMapView.tsx 리팩토링**(동작 보존)

(a) import 교체 — 상단 import 블록에 추가, 인라인 상수 `TILE_NOTICE_KEY` 줄(line 13) 삭제:

```tsx
import { hasTileConsent, setTileConsent } from '@/components/map/tileConsent';
import { TileNotice } from '@/components/map/TileNotice';
```

(b) 최초 진입 고지 effect(현재 line 28~32)를 교체:

```tsx
  useEffect(() => {
    if (hasTileConsent()) setAck(true);
    else setNeedNotice(true);
  }, []);
```

(c) `acceptNotice`(현재 line 127~131)를 교체:

```tsx
  const acceptNotice = () => {
    setTileConsent();
    setNeedNotice(false);
    setAck(true);
  };
```

(d) JSX의 인라인 notice 블록(현재 line 147~160 `{needNotice && (...)}`)을 교체:

```tsx
          {needNotice && <TileNotice onAccept={acceptNotice} />}
```

(e) 사용하지 않게 된 스타일 상수 `noticeOverlay`, `noticeCard`, `noticeText`, `noticeBtn`(현재 line 193~225) 삭제. (`screen`/`bar`/`mapWrap`/`mapBox`/`empty` 등 나머지는 유지.)

- [ ] **Step 6: 통과 확인** — Run: `npm test -- tileConsent trip` → PASS(트립 테스트 `tripDisplayName`은 모달 미참조라 무영향)

- [ ] **Step 7: 커밋**

```bash
git add src/components/map/tileConsent.ts src/components/map/TileNotice.tsx src/components/trip/TripMapView.tsx tests/components/tileConsent.test.ts
git commit -m "refactor(map): extract shared tile-consent (reused by region map)"
```

---

## Task 2: 지역 레이어 스타일 순수 helper (regionLayerStyle.ts)

**Files:**
- Create: `src/lib/regionLayerStyle.ts`
- Test: `tests/lib/regionLayerStyle.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```ts
// tests/lib/regionLayerStyle.test.ts
import { describe, it, expect } from 'vitest';
import { levelLayerConfig, sanitizeColor, buildFillColorExpression } from '@/lib/regionLayerStyle';

describe('levelLayerConfig', () => {
  it('시군구 설정', () => {
    expect(levelLayerConfig('sigungu')).toEqual({
      url: '/geo/sigungu_display.geojson', codeProp: 'sgg', nameProp: 'sggnm', total: 255,
    });
  });
  it('시도 설정', () => {
    expect(levelLayerConfig('sido')).toEqual({
      url: '/geo/sido_display.geojson', codeProp: 'sido', nameProp: 'sidonm', total: 17,
    });
  });
});

describe('sanitizeColor', () => {
  it('정상 hex 통과', () => {
    expect(sanitizeColor('#3A9D6B')).toBe('#3A9D6B');
    expect(sanitizeColor('  #fff ')).toBe('#fff');
  });
  it('비정상 값 → fallback(주입 방지)', () => {
    expect(sanitizeColor('red')).toBe('#DDDDE3');
    expect(sanitizeColor('')).toBe('#DDDDE3');
    expect(sanitizeColor('#fff; }')).toBe('#DDDDE3');
    expect(sanitizeColor('', '#000')).toBe('#000');
  });
});

describe('buildFillColorExpression', () => {
  const colors = {
    visited: '#3A9D6B', want: '#E0982E', unvisited: '#DDDDE3',
    separator: '#D7D7DC', label: '#111', surface: '#fff',
  };
  it('feature-state state → 색 match 식, 기본=미방문', () => {
    expect(buildFillColorExpression(colors)).toEqual([
      'match', ['feature-state', 'state'],
      'visited', '#3A9D6B',
      'wantToGo', '#E0982E',
      '#DDDDE3',
    ]);
  });
  it('비정상 색은 fill 식에서도 무력화', () => {
    const e = buildFillColorExpression({ ...colors, visited: 'url(x)' }) as string[];
    expect(e[3]).toBe('#DDDDE3'); // visited 자리 sanitize
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `npm test -- regionLayerStyle` → FAIL(module not found)

- [ ] **Step 3: regionLayerStyle.ts 구현**

```ts
// src/lib/regionLayerStyle.ts — 지역 MapLibre 레이어 스타일 빌더.
// 순수 부분(설정·색 식·검증)은 테스트 대상. resolveStateColors만 DOM 의존(테스트 제외).

import type { Level } from '@/components/region/LevelToggle';

export interface LevelLayerConfig {
  url: string;
  codeProp: string;
  nameProp: string;
  total: number;
}

/** 레벨별 표시용 geojson URL·코드/이름 속성·총 지역수. (시도는 sido_display, 시군구는 sigungu_display) */
export function levelLayerConfig(level: Level): LevelLayerConfig {
  return level === 'sigungu'
    ? { url: '/geo/sigungu_display.geojson', codeProp: 'sgg', nameProp: 'sggnm', total: 255 }
    : { url: '/geo/sido_display.geojson', codeProp: 'sido', nameProp: 'sidonm', total: 17 };
}

export interface StateColors {
  visited: string;
  want: string;
  unvisited: string;
  separator: string;
  label: string;
  surface: string;
}

const HEX = /^#[0-9a-fA-F]{3,8}$/;
const SAFE_UNVISITED = '#DDDDE3';

/** maplibre paint 주입 전 색 검증(다크/사용자 테마 대비). 비정상 값은 안전 기본색. */
export function sanitizeColor(c: string, fallback = SAFE_UNVISITED): string {
  const v = (c ?? '').trim();
  return HEX.test(v) ? v : fallback;
}

/** feature-state 'state'(방문상태) → fill-color match 식. 미설정(null)=미방문 기본색(마지막 인자). */
export function buildFillColorExpression(colors: StateColors): unknown[] {
  return [
    'match',
    ['feature-state', 'state'],
    'visited', sanitizeColor(colors.visited),
    'wantToGo', sanitizeColor(colors.want),
    sanitizeColor(colors.unvisited),
  ];
}

/** runtime CSS 토큰 → 색. DOM 의존(테스트 제외, 얇은 어댑터). */
export function resolveStateColors(): StateColors {
  const cs = getComputedStyle(document.documentElement);
  const get = (n: string) => cs.getPropertyValue(n).trim();
  return {
    visited: get('--st-visited'),
    want: get('--st-want'),
    unvisited: get('--st-unvisited'),
    separator: get('--separator'),
    label: get('--label'),
    surface: get('--surface'),
  };
}
```

- [ ] **Step 4: 통과 확인** — Run: `npm test -- regionLayerStyle` → PASS

- [ ] **Step 5: 커밋**

```bash
git add src/lib/regionLayerStyle.ts tests/lib/regionLayerStyle.test.ts
git commit -m "feat(region): maplibre region layer style builders (level/fill/sanitize)"
```

---

## Task 3: RegionMapView (MapLibre 지역지도 컴포넌트)

**Files:**
- Create: `src/components/region/RegionMapView.tsx`

> MapLibre는 jsdom에서 동작 불가(코드베이스 관례 — TripMapView도 컴포넌트 단위 테스트 없음). 본 컴포넌트는 Task 5의 브라우저 수동 검증으로 확인한다. 순수 로직은 Task 2에서 분리·테스트됨.

- [ ] **Step 1: RegionMapView.tsx 작성**

```tsx
'use client';

// src/components/region/RegionMapView.tsx — 지역지도(MapLibre). 실제 basemap 위 시군구/시도 반투명 색칠.
// 경로지도(TripMapView)와 동일 포맷: OpenFreeMap positron 타일 + 네이티브 줌/팬 + 동일 동의 고지.
//   - 색칠: promoteId(지역코드)+feature-state(방문상태) → data-driven fill-color match.
//   - 라벨: symbol 레이어(네이티브 declutter=줌인 시 점진 노출). 한글은 localIdeographFontFamily로 로컬 렌더.
//   - ack 후에만 maplibre/타일 로드. 레벨 변경 시 재생성, 방문상태 변경은 feature-state만 갱신(재생성 X).

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { VisitState } from '@/core/visitState';
import type { Level } from '@/components/region/LevelToggle';
import { hasTileConsent, setTileConsent } from '@/components/map/tileConsent';
import { TileNotice } from '@/components/map/TileNotice';
import { levelLayerConfig, buildFillColorExpression, resolveStateColors } from '@/lib/regionLayerStyle';

const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';
// 대한민국 본토 bounds(gen-choropleth FIT과 동일 — 울릉/독도 제외 프레이밍).
const KOREA_BOUNDS: [[number, number], [number, number]] = [
  [124.6, 33.0],
  [130.0, 38.65],
];
const HANGUL_FONT = "'Apple SD Gothic Neo','Noto Sans KR',sans-serif";

export function RegionMapView({
  level,
  stateByCode,
}: {
  level: Level;
  stateByCode: Record<string, VisitState>;
}) {
  const mapEl = useRef<HTMLDivElement>(null);
  const [needNotice, setNeedNotice] = useState(false);
  const [ack, setAck] = useState(false);

  const mapRef = useRef<import('maplibre-gl').Map | null>(null);
  const loadedRef = useRef(false);
  // feature-state 갱신이 최신 상태를 읽도록 ref 미러(effect 재생성 없이 갱신).
  const stateRef = useRef(stateByCode);
  stateRef.current = stateByCode;
  const stateKey = useMemo(
    () =>
      Object.keys(stateByCode)
        .sort()
        .map((k) => `${k}:${stateByCode[k]}`)
        .join(','),
    [stateByCode],
  );

  // 방문상태를 모든 feature-state로 재적용(미설정 코드는 fill 식 기본=미방문).
  const applyStates = (map: import('maplibre-gl').Map) => {
    map.removeFeatureState({ source: 'regions' });
    for (const [code, state] of Object.entries(stateRef.current)) {
      map.setFeatureState({ source: 'regions', id: code }, { state });
    }
  };

  // 최초 진입 1회 타일 고지(경로지도와 키 공유 → 한쪽에서 동의했으면 통과).
  useEffect(() => {
    if (hasTileConsent()) setAck(true);
    else setNeedNotice(true);
  }, []);

  // 지도 생성 + 레벨별 레이어. ack 후에만 maplibre/타일 로드. 레벨 변경 시 재생성.
  useEffect(() => {
    if (!ack || !mapEl.current) return;
    let cancelled = false;
    loadedRef.current = false;
    const cfg = levelLayerConfig(level);

    (async () => {
      const maplibre = (await import('maplibre-gl')).default;
      if (cancelled || !mapEl.current) return;

      const map = new maplibre.Map({
        container: mapEl.current,
        style: STYLE_URL,
        bounds: KOREA_BOUNDS,
        fitBoundsOptions: { padding: 20 },
        attributionControl: { compact: true },
        localIdeographFontFamily: HANGUL_FONT,
      });
      mapRef.current = map;

      map.on('load', async () => {
        if (cancelled || !mapRef.current) return;
        const geo = await fetch(cfg.url)
          .then((r) => r.json())
          .catch(() => null);
        if (cancelled || !geo || !mapRef.current) return;

        const colors = resolveStateColors();
        map.addSource('regions', { type: 'geojson', data: geo, promoteId: cfg.codeProp });
        map.addLayer({
          id: 'region-fill',
          type: 'fill',
          source: 'regions',
          paint: { 'fill-color': buildFillColorExpression(colors) as never, 'fill-opacity': 0.55 },
        });
        map.addLayer({
          id: 'region-line',
          type: 'line',
          source: 'regions',
          paint: { 'line-color': colors.separator || '#D7D7DC', 'line-width': 0.8 },
        });
        map.addLayer({
          id: 'region-label',
          type: 'symbol',
          source: 'regions',
          layout: {
            'text-field': ['get', cfg.nameProp],
            'text-size': ['interpolate', ['linear'], ['zoom'], 6, 9, 9, 12, 12, 15],
            'text-font': ['Noto Sans Regular'],
          },
          paint: {
            'text-color': colors.label || '#111',
            'text-halo-color': colors.surface || '#fff',
            'text-halo-width': 1.2,
          },
        });

        loadedRef.current = true;
        applyStates(map);
      });
    })();

    return () => {
      cancelled = true;
      loadedRef.current = false;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // level/ack 변경 시에만 재생성. stateByCode는 아래 effect에서 feature-state로 갱신.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ack, level]);

  // 방문상태 변경(라이브 import) 시 재생성 없이 feature-state만 갱신.
  useEffect(() => {
    const map = mapRef.current;
    if (map && loadedRef.current) applyStates(map);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateKey]);

  const accept = () => {
    setTileConsent();
    setNeedNotice(false);
    setAck(true);
  };

  return (
    <div style={wrap}>
      <div ref={mapEl} style={mapBox} />
      {needNotice && <TileNotice onAccept={accept} />}
    </div>
  );
}

const wrap: CSSProperties = { position: 'relative', flex: 1, minHeight: 0 };
const mapBox: CSSProperties = { position: 'absolute', inset: 0 };
```

- [ ] **Step 2: 타입/빌드 확인** — Run: `npm run build`
Expected: 타입 통과(maplibre 타입은 동적 import 시그니처로 해석). 실패 시 `fill-color` 캐스팅(`as never`)·layout 식 타입만 조정, 로직 불변.

- [ ] **Step 3: 커밋**

```bash
git add src/components/region/RegionMapView.tsx
git commit -m "feat(region): MapLibre region map view (basemap + state choropleth + labels)"
```

---

## Task 4: RegionMapScreen 배선(Choropleth → RegionMapView)

**Files:**
- Modify: `src/components/region/RegionMapScreen.tsx`

- [ ] **Step 1: RegionMapScreen.tsx 전체 교체**

```tsx
'use client';

// src/components/region/RegionMapScreen.tsx — 지역지도 탭.
// MapLibre 지역지도(RegionMapView, 지연 로드) + 정복률 헤더 + 레벨 토글 + 범례.
// iOS RegionMapScreen 대응(상세 시트/가고싶음은 프로토 제외).

import { useState, type CSSProperties } from 'react';
import dynamic from 'next/dynamic';
import { StatHeader } from '@/components/region/StatHeader';
import { LevelToggle, type Level } from '@/components/region/LevelToggle';
import { Legend } from '@/components/region/Legend';
import { useRegionStatuses } from '@/hooks/useRegionStatuses';
import { levelLayerConfig } from '@/lib/regionLayerStyle';

// maplibre는 RegionMapView에서만 로드 → 지역탭은 진입+동의 전까지 외부 호출 없음.
const RegionMapView = dynamic(
  () => import('@/components/region/RegionMapView').then((m) => m.RegionMapView),
  { ssr: false, loading: () => <div style={loading}>지도 불러오는 중…</div> },
);

export function RegionMapScreen() {
  const [level, setLevel] = useState<Level>('sigungu');
  const { sigungu, sido } = useRegionStatuses();

  const stateByCode = level === 'sigungu' ? sigungu : sido;
  const visitedCount = Object.values(stateByCode).filter((s) => s === 'visited').length;
  const total = levelLayerConfig(level).total;

  return (
    <div style={screen}>
      <LevelToggle level={level} onChange={setLevel} />
      <StatHeader level={level} visitedCount={visitedCount} total={total} />
      <RegionMapView level={level} stateByCode={stateByCode} />
      <Legend />
    </div>
  );
}

const screen: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  minHeight: 0,
};
const loading: CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--label2)',
};
```

- [ ] **Step 2: 전체 테스트** — Run: `npm test`
Expected: 기존 + 신규 전부 PASS. `region.test`(Choropleth 직접 렌더)·`RootTabs.test`(온보딩) 무영향. (RegionMapScreen은 jsdom에서 RegionMapView를 dynamic 미해결 → loading placeholder, 직접 렌더 테스트 없음.)

- [ ] **Step 3: 빌드** — Run: `npm run build` → 통과

- [ ] **Step 4: 커밋**

```bash
git add src/components/region/RegionMapScreen.tsx
git commit -m "feat(region): wire RegionMapScreen to MapLibre view (replace SVG choropleth)"
```

---

## Task 5: 멀티에이전트 리뷰 + 수동 브라우저 검증 (생략 불가)

> 글로벌 CLAUDE.md 필수 절차 + coding-lessons(2026-04-23): "UI는 브라우저 실제 접근까지 확인 후에만 완료".

- [ ] **Step 1: Code Reviewer + Security Engineer 병렬 리뷰** — 변경/생성 파일 전체. 중점:
  - 메모리/리소스: `map.remove()` cleanup, level 재생성 시 누수, feature-state 갱신 경로.
  - 프라이버시: 타일 외 외부 호출 없음(동의 게이트 동작), geojson은 same-origin, 사진/좌표 미전송.
  - 주입: `fill-color`/`text`에 들어가는 색·이름이 신뢰 가능한가(sanitizeColor + 이름은 자체 번들 geojson).
  - 회귀: TripMapView 동의 리팩토링이 동작 보존인가.
  - 결과 High/고가치 Medium 반영 후 커밋, 잔여는 `docs/todos/2026-06-11-region-maplibre-followup.md` 이관.

- [ ] **Step 2: 수동 브라우저 검증**(아래 Verification)

---

## Verification

**자동:**
```powershell
npm test          # 신규 단위(tileConsent, regionLayerStyle) + 기존 전부 PASS
npm run build     # 타입·빌드 통과
```

**수동(dev 서버 + 브라우저):**
```powershell
npm run dev       # http://localhost:3000
```
샘플 7장 가져오기(필요 시 `node scripts/make-geotagged.mjs`) 후 **지역지도 탭**:

1. **동의 고지(#2)**: 지역 탭 진입 시 외부 타일 고지 모달 → "확인" 후 실제 지도 표시. (경로지도에서 이미 동의했으면 모달 생략되는지도 확인 = 키 공유.)
2. **실제 basemap + 색칠(#1)**: OpenFreeMap 지도 위에 시군구가 **반투명 색**으로(방문=초록, 가고싶음=주황, 미방문=회색) 덮이는지. basemap이 색 사이로 비치는지.
3. **방문상태 반영**: 가져온 사진의 시군구만 방문색인지(정복률 헤더 숫자와 일치).
4. **지역명 라벨(#1)**: 한글 시군구명이 보이고, **줌인할수록 더 많은(작은) 지역명**이 나타나는지(MapLibre 네이티브 declutter). 한글이 깨지지 않는지(localIdeographFontFamily).
5. **네이티브 핀치/팬(#2 핵심)**: 모바일 에뮬/실기기에서 두 손가락 핀치 줌·팬이 **부드럽게**(이전 SVG 커스텀 불편 해소). 한 손가락 팬 1:1.
6. **시도 토글**: "시도"로 전환 시 17개 시도가 색칠+시도명 라벨, 정복률 헤더가 시도 기준으로 갱신. 다시 시군구 전환 정상.
7. **범례/정복률**: 하단 범례 3색, 상단 정복률(%) 정확.
8. **영속화**: 새로고침 후 동의 유지(모달 미재출현) + 색칠 유지.

**완료 기준:** 1~8 브라우저 확인 + `npm test`/`npm run build` 통과 + 멀티에이전트 리뷰 반영. 셋 중 하나라도 미수행 시 "완료" 선언 금지.

**검증 중 발견 가능 이슈 & 대응(문서화):**
- 라벨 한글 미표시 → `localIdeographFontFamily`가 적용됐는지, `text-font` 값을 positron이 제공하는 글리프명으로(예: `['Noto Sans Regular']`) 확인.
- 라벨 과다/과소 → `text-size` interpolate stop 또는 `symbol-sort-key`/`text-allow-overlap` 조정(로직 불변).
- geojson 3MB 로딩 체감 지연 → loading placeholder 노출(이미 dynamic loading + map load 단계). 필요 시 후속 단순화(`sigungu_display` 추가 단순화)는 별도.

---

## Self-Review 체크

- **#1(시군구명+줌 상세)**: Task 3 symbol 레이어(네이티브 declutter) + localIdeograph 한글. ✅
- **#2(모바일 핀치 + 경로지도 동일)**: MapLibre 네이티브 제스처 + positron 타일 + 공용 동의(Task 1) → 경로지도와 동일 substrate. ✅
- **반투명 색칠**: feature-state + fill-opacity 0.55(Task 2·3). ✅
- **유지 요소**: 토글·정복률·범례(RegionMapScreen 유지) + 라벨(symbol). ✅
- **타입 일관성**: `levelLayerConfig`/`buildFillColorExpression`/`resolveStateColors` 시그니처가 Task 2 정의와 Task 3·4 호출에서 일치. `Level` 타입은 `LevelToggle`에서 import(기존). ✅
- **테스트 무손상**: `Choropleth.tsx` 미삭제 → `region.test` 유지. `RootTabs.test`는 온보딩 경로라 RegionMapView 미마운트. ✅
- **프라이버시/보안**: 동의 게이트 후에만 타일, geojson same-origin, 색 sanitize(주입 방지), 사진/좌표 미전송. ✅
- **core 불변**: `mapViewport.ts`(골든 290) 미변경. ✅
- **알려진 한계(후속)**: ① 미사용이 된 SVG 스택(Choropleth·gen-choropleth·paths.json·mapProjection) 정리는 삭제 확인 후 별도. ② 읽기전용(탭-방문표시 미구현). ③ 다크모드 토큰은 sanitize 통과하나 라벨 대비는 수동 확인 권장. ④ geojson 단순화 추가 최적화 여지.
