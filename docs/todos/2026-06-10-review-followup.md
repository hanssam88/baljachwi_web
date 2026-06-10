# 프로토타입 리뷰 후속 (2026-06-10)

> 멀티에이전트 리뷰(Code Reviewer + Security) 13건 중, High·고가치 Medium은 반영 완료.
> 아래는 이후 세션으로 이관한 Medium/Low. 본 구현(프로토 → 정식)으로 진행 시 처리.

## 반영 완료 (이번 세션)
- **[High] TripMapView liveQuery effect 재생성** — deps를 `[ack, trip.id, photosKey]`로 좁힘(map 재생성·타일 재fetch 방지).
- **[Medium] objectURL 누수** — cancelled 체크를 createObjectURL 이전으로, 핀 생성 try/catch.
- **[Medium] 동시 importFiles** — useScan에 runningRef 가드(중복 호출 무시).
- **[Medium] 타일 고지 문구 정확화** — "대략 위치가 타일 서버에 전달될 수 있음 / 사진·정확 GPS·식별자는 미전송"으로 수정.
- **[Medium] Choropleth 패닝 스케일** — 화면 픽셀 델타를 viewBox 단위로 환산(getBoundingClientRect).
- **[Low] 핀 생성 예외 격리** — 위 try/catch로 함께 처리.

## 이관 (이후 세션)

### Medium
- **[repo.ts] 썸네일 고아 prune 미구현** — reconcile이 photoRefs를 갈아끼울 때 prune된 사진의 `thumbs` 행이 남아 IndexedDB 용량 단조 증가. reconcile 후 생존 localIdentifier 집합 기준으로 thumbs 고아 정리 단계 추가(런타임 경로 한정 — fake-indexeddb Blob 제약 회피). 보안 관점에서도 "뺀 사진의 시각 데이터 기기 내 잔존" 이슈와 동일.

### Low
- **[thumbnail.ts/useScan.ts] 썸네일 동시성 사장** — thumbnail.ts에 MAX_CONCURRENT=4 세마포어가 있으나 useScan이 직렬 await라 동시성 미활용. 제한 동시성 풀로 병렬 디스패치.
- **[exif.ts] fileLocalIdentifier 32비트 FNV** — 대량(수만 장) 라이브러리에서 해시 충돌 가능 → dedup·썸네일 키 오염. 64비트 확장 또는 원문 키.
- **[useTrips.ts] useRegionNames 매 마운트 재fetch** — 모듈 스코프 Promise 캐시로 1회 fetch 공유.
- **[TripMapView.tsx] 타일 동의 철회 수단 없음** — `baljachwi-tile-notice-ack`가 origin 전역·영구. 설정/데이터초기화에 동의 철회(localStorage.removeItem) 포함, resetAll에도 키 제거 추가.
- **[TripMapView.tsx] --accent 미검증 주입** — 현재 정적 토큰이라 안전하나, 다크모드/사용자 테마 도입 시 maplibre paint 주입 전 `/^#[0-9a-fA-F]{3,8}$/` 검증 가드.

## 비고
- 코어 로직(src/core/*)·reconcile 순수 로직은 골든 테스트 290건으로 검증 — 리뷰 무지적.
- 프로토 제외 범위(여행 편집·백업·RegionDetailSheet·HEIC 썸네일·E2E 확장)는 기존 스펙대로 이후 세션.
