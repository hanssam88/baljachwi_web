# 발자취 웹 — 사진 재업로드 + 단일 사진 지도 후속 이슈

> 작성일: 2026-06-11 / 출처: feat/photo-reupload-single-map 멀티에이전트 리뷰(Code Reviewer + Security Engineer)
> 본 브랜치에서 High 0건, 고가치 Medium 1건(탭 전환 UX)은 반영 완료. 아래는 잔여 Low(선택적 개선).

## Low (선택적)

- [ ] **useAllPhotos 풀 테이블 구독 최적화** (`src/hooks/useTrips.ts` useAllPhotos)
  - `photoRefs.toArray()`로 전체 로드 → 사진이 수천 장일 때 메모리/objectURL 다량 생성 가능.
  - 현재는 여행 0개(빈 상태)에서만 도달하므로 실사용 영향 작음(프로토타입 스코프).
  - 규모 커지면: `.count()`로 존재 여부만 판정 + 좌표만 select하는 가벼운 쿼리로 분리 검토.

- [ ] **PhotoMapView backgroundImage 방어적 보간** (`src/components/trip/PhotoMapView.tsx`)
  - `elm.style.backgroundImage = \`url(${url})\`` — url은 `URL.createObjectURL`(blob: 스킴, 통제됨)이라 현재 XSS/CSS injection 불가.
  - 방어적으로 `url("${url}")` 따옴표 래핑 또는 `setProperty` 사용 가능. 단 원본 TripMapView(골든 동작 보존)와 동일 패턴 유지 위해 보류. 실익 없음.

## 검증 완료(조치 불요)

- 카메라 bbox 출처 변경(`trip.minLat/..` → `photosBBox(photos)`): tripSegmenter가 동일 사진 좌표로 trip bbox 산출 → behavior-preserving 확인.
- 타일 동의(ack) 게이트: 빈 상태 마커맵(F2)도 동일 PhotoMapView 사용 → 동의 우회 경로 없음.
- objectURL 생명주기: createObjectURL 직전 cancelled 가드 2회 + cleanup 전량 revoke → 누수 없음.
- 좌표 외부 비전송, applyScan(ADD) 데이터 무결성(prune·home 미터치), 코어/의존성 미변경.
