# 지역지도 MapLibre 포팅 리뷰 후속 (2026-06-11)

> 멀티에이전트 리뷰(Code Reviewer + Security Engineer 병렬) + 각 발견 적대적 검증 결과.
> **종합 판정: 양 리뷰 모두 SHIP.** 즉시 수정(High/고가치 Medium) 항목 없음 → 아래 Low 전부 후속 이관.
> 대상 커밋: tileConsent 추출 / regionLayerStyle / RegionMapView / RegionMapScreen 배선.

## 반영 완료 (이번 작업)

- 없음 (적대적 검증 결과 즉시 수정이 필요한 High/Medium 부재).

## 이관 (이후 세션)

### Low

- **[RegionMapView.tsx] 방문상태 변경 시 전체 feature-state O(n) 재구축** — `applyStates`가 `removeFeatureState({source})` 후 전 코드 `setFeatureState` 재적용. 정확성은 OK(첫 로드 전 no-op, 라이브 import 반영 정확). 최적화하려면 직전 `stateByCode` 스냅샷을 ref로 보관해 추가/변경/제거된 코드만 set/remove하는 diff 적용. 현 규모(255/17개)에선 단순함 유지가 합리적이라 선택 사항.

- **[regionLayerStyle.ts] sanitizeColor HEX 정규식이 5/7자리 잘못된 hex도 허용** — `/^#[0-9a-fA-F]{3,8}$/`는 #abcde(5자리) 같은 비표준도 통과. 입력이 통제된 정적 토큰이라 실질 위험 없음. 엄밀히 하려면 `/^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/`로 좁힘.

- **[RegionMapView.tsx] 레벨 토글마다 지도 재생성 + geojson 재fetch (캐시 없음)** — `[ack, level]` effect가 재생성하며 `fetch(cfg.url)` 재호출. same-origin 정적 자산이라 보안 차단 사유 아님. 토글 빈번 시 체감 지연이면 fetch한 geo를 level별 모듈/ref에 메모이즈해 재fetch 회피. 또는 정적 자산 Cache-Control 확인. 성능 후속.

- **[RegionMapView.tsx] defense-in-depth: line-color/text-color/text-halo-color paint 미sanitize (기각, 일관성 메모)** — fill-color만 `sanitizeColor`를 거치고 `line-color`(separator)·`text-color`(label)·`text-halo-color`(surface)는 `|| '#fallback'` 빈문자열 가드만. **실제 보안이슈 아님으로 기각**: 해당 토큰은 `tokens.css`의 정적 hex 리터럴이고 유일한 동적 setter(`lib/tokens.ts` applyTokens)도 하드코딩 상수맵·enum 키만 사용(문자열 보간/사용자입력 경로 전무) + 현재 미호출. MapLibre는 paint color를 파싱만 하고 eval 안 함. **다만** 다크모드/사용자 테마 도입 시 일관성 위해 line/text 색도 `sanitizeColor`로 감싸는 게 안전(프로토 followup `2026-06-10-review-followup.md`의 `--accent 미검증 주입` 항목과 동일 취지).

## 미사용이 된 SVG 스택 정리 (삭제 확인 필요 — 별도)

본 포팅으로 아래는 런타임에서 미사용이 되었으나 **삭제하지 않음**(테스트 무손상 + 삭제는 사용자 확인 필요):
- `src/components/region/Choropleth.tsx` (단, `tests/components/region.test.tsx`가 직접 렌더 중 → 삭제 시 테스트도 함께 정리 필요)
- `scripts/gen-choropleth.mjs`, `public/geo/korea-*.paths.json`(gitignore), `src/core/mapProjection.ts`(골든 테스트 있음 — 신중)
- 정리하려면 사용자 확인 후 별도 세션에서 테스트 동반 제거.

## 비고

- MapLibre 컴포넌트(RegionMapView)는 jsdom 미동작 → 코드베이스 관례상 단위 테스트 없이 브라우저 수동 검증. 순수 helper(tileConsent 3건, regionLayerStyle 6건)는 TDD 완료.
- `src/core/*`(골든 290건) 미변경 — 회귀 없음(전체 299건 통과).
