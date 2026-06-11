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

---

# 여행 목록 탭 + 같은-날 핀 연결선 후속 이슈

> 작성일: 2026-06-11 / 출처: feat/trip-list-tab-day-connector 멀티에이전트 리뷰(Code Reviewer + Security Engineer)
> 양쪽 High 0건 / Medium 0건. L1(stale 주석)은 본 브랜치에서 반영 완료. 아래는 잔여 Low.

## Low (선택적)

- [ ] **EXIF 좌표 NaN/Infinity 방어** (`src/core/photoScan.ts` 좌표 필터, `src/lib/exif.ts:60-61`)
  - 현재 필터는 `=== null`과 `(0,0)` 원점만 제외 → `NaN`/`Infinity`가 그대로 PhotoRef에 저장될 수 있음.
  - 새 연결선이 두 번째 소비자(LineString 좌표)로 추가됨. MapLibre는 대체로 해당 세그먼트만 깨뜨려 로컬 영향만 있음(severity Low).
  - 권장: `Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat)<=90 && Math.abs(lon)<=180` 필터 추가. **단 코어(photoScan) 변경이라 골든 영향 검토 후 별도 PR.**

- [ ] **`--accent` 라인 색상 런타임 갱신 안 됨** (`src/components/trip/PhotoMapView.tsx`)
  - `getComputedStyle(...).--accent`를 `map.on('load')` 시점 1회만 읽음 → 런타임 테마 전환 시(맵 미리마운트) 색상 stale.
  - 기존 route-line도 동일 패턴(본 변경이 도입한 것 아님). 다크모드 작업 시 함께 처리.

- [ ] **단일-사진 날짜 핀도 cursor:pointer + 클릭 리스너 부착** (`src/components/trip/PhotoMapView.tsx`)
  - 같은 날 1장뿐인 핀 클릭 시 연결선 없음(빈 결과). 무해한 UX, 보안 영향 없음. 필요 시 ≥2장 날짜만 pointer 부여.

- [ ] **빈 상태 카피 통일** (`TripListScreen.tsx` ↔ `RouteMapScreen.tsx`) — `fix/triplist-empty-no-map-duplication` 리뷰 Low
  - 여행목록 0개+사진 0장 "아직 여행이 없습니다", 0개+사진 N장 "아직 여행으로 묶인 사진이 없어요" vs 경로지도 0장 "아직 표시할 사진이 없습니다" — 탭마다 '사진 없음' 표현 상이. 기능 결함 아님. 카피 토큰화로 통일 검토.

## 의도된 동작(조치 불요)

- **경로지도(전체-핀) 탭의 크로스-트립 같은-날 연결**: `RouteMapScreen`은 `useAllPhotos()`(전체) → 핀 클릭 시 같은 `localDay`의 모든 사진을 연결(서로 다른 트립이라도). 사용자 명시 요청("경로지도=전체 핀 지도 + 그날 저장된 핀들을 이어주기")과 일치. `localDay`는 epoch 기준 절대 일수라 연도별 같은 월/일은 충돌하지 않음(다른 정수). per-trip `TripMapView`는 입력이 이미 단일 트립으로 스코프됨.

---

# 여행 목록 → 날짜별 일자 카드 전환 후속(dead-code)

> 작성일: 2026-06-11 / 출처: feat/triplist-date-grouping (여행 목록을 세그먼터 trip → 현지 날짜별 카드로 완전 교체)
> 사용자 명시 요청("동일 날짜로 묶어줘, 구글 타임라인 참고")으로 세그먼터 기반 여행 목록 UI를 제거. 데이터/코어(tripSegmenter·tripRecords)는 보존.

## Dead-code (삭제 금지 — 사용자 확인 후 별도 PR)

교체 후 아래 자산이 **프로덕션 미사용**이 됨(테스트 파일/자기 정의 외 import 없음, `tsc`/`vitest`는 실패하지 않음). 세그먼터 trip 목록 복원/병행 가능성이 있어 **삭제하지 않고** 보존:

- [ ] `src/components/trip/TripMapView.tsx` — per-trip 핀 지도. TripListScreen이 유일 소비처였음(이제 미사용). 테스트 `tests/components/trip.test.tsx`만 참조.
- [ ] `src/components/trip/TripRow.tsx` — 세그먼터 여행 행. TripListScreen이 유일 소비처였음(이제 미사용). DayGroupRow가 동형 스타일을 복제했으므로 양립 가능.
- [ ] `src/hooks/useTrips.ts` `useTripsByRecent()` — 프로덕션 소비처 0(TripListScreen 제거 후).
- [ ] `src/hooks/useTrips.ts` `usePhotosForTrip()` — 위 TripMapView/TripRow(둘 다 dead)에서만 사용 → 연쇄 dead.
  - 정리 시 순서: TripMapView/TripRow 제거 → usePhotosForTrip/useTripsByRecent 제거 → 관련 테스트(`trip.test.tsx`) 정리. 한 번에 PR로.

## Low (멀티에이전트 리뷰 — Code Reviewer, High/Medium 0건)

- [ ] **빈 상태 카피를 일자 카드 모델 어휘로 통일** (`TripListScreen.tsx`)
  - 현재 사진 0장 시 "아직 여행이 없습니다" — 새 모델(일자 카드)에선 '여행' 어휘가 어긋남. 예: "아직 기록된 날이 없습니다".
  - 날짜 그룹핑 특성상 사진 1장이라도 있으면 항상 카드가 생겨 '사진 있는데 비어보임' 상황은 사라짐(기능 결함 아님). 위 '빈 상태 카피 통일' 항목과 함께 경로지도 탭과 토큰화 통일.

- [x] **`tripDisplayName` 입력 정렬 계약 오해 제거** (`DayGroupRow.tsx`) — 본 브랜치 반영 완료
  - `group.photos`는 takenAt 오름차순(groupPhotosByDay 보장)인데 `tripLabel.ts` 주석은 sortIndex 가정 → 지역 노출 순서 오해 소지. 집합 정확성 문제 아님(표시 순서만).
  - 조치: DayGroupRow 호출부에 의도 정렬(takenAt=촬영순) 명시 주석 추가로 해소. `tripLabel.ts`(재사용 무변경 자산)는 미수정 — 추후 주석 일반화는 선택.

---

# 사진 삭제(경로지도 핀 + 여행목록 다중선택) 후속 이슈

> 작성일: 2026-06-12 / 출처: feat/photo-delete 멀티에이전트 리뷰(Code Reviewer + Security Engineer)
> 양쪽 High 0건. Code Reviewer Medium 2건 / Security Medium 0건.
> M2(삭제 실패 무음 무시 — 비가역 작업)는 본 브랜치 반영 완료(PhotoSelectScreen·PhotoMapView 에러 상태 + role="alert" 노출, 선택 유지 재시도). M1 + 잔여 Low는 아래.

## Medium → 의도된 스코프(조치 보류)

- [ ] **삭제 시 trips/tripRecords 메타데이터 stale** (M1, `src/data/deleteOps.ts`) — 플랜 Risk #2 명시 트레이드오프
  - 사진 삭제 시 sigungu RegionStatus만 재계산하고 `trips`(bbox/대표지역)는 미터치 → 여행 bbox/대표지역이 일시적으로 삭제 전 값일 수 있음.
  - 현재 trips는 UI 비노출 + 다음 스캔 reconcile에서 정합화되므로 실사용 영향 없음(의도된 트레이드오프).
  - 트립 메타가 UI 노출되면: deleteOps에서 생존 사진으로 trip bbox/대표지역도 재계산하거나, 삭제를 트리거로 부분 reconcile 호출 검토.

## Low (선택적)

- [ ] **PhotoSelectScreen 썸네일 점진 렌더** (`src/hooks/useThumbUrls.ts`)
  - `useThumbUrls`는 모든 id 썸네일을 모은 뒤 한 번에 `setUrls` → 사진이 많으면 그리드가 일괄 늦게 채워짐(빈 셀 후 한꺼번에 표시).
  - 개선: 루프 내에서 점진적으로 `setUrls((m) => ({ ...m, [id]: url }))` 갱신하면 셀이 채워지는 대로 표시. 단 리렌더 증가 트레이드오프 — 규모 커질 때 검토.

- [ ] **ConfirmDialog busy 중 중복 확인 가드 일관화** (`src/components/common/ConfirmDialog.tsx`)
  - 현재 busy 가드는 호출부(`doDelete` 진입 `if (busy) return` + 트리거 버튼 `disabled`)에만 있고 ConfirmDialog의 "삭제" 버튼 자체는 항상 활성.
  - 확인 다이얼로그가 열린 짧은 시간 동안 "삭제" 연타 시 `doDelete`는 busy 가드로 중복 실행을 막지만, 시각 피드백(버튼 비활성)은 없음.
  - 개선: ConfirmDialog에 선택적 `busy`/`disabled` prop 추가해 진행 중 확인 버튼 비활성. (Task 10 브라우저 실측에서 연타 무해 확인.)

- [ ] **테스트 Blob 캐스팅 정리** (`tests/data/repo.delete.test.ts`)
  - fake-indexeddb structured-clone 제약 회피로 `{} as Blob` 캐스팅 사용(db.ts:20 패턴 차용). 기능 정상이나 타입 안전성 낮음.
  - 개선: 실제 `new Blob()`로 교체 가능한지(fake-indexeddb 버전 의존) 확인 후 정리.

## Security(검증 완료 — 조치 불요)

- 좌표/사진 데이터 외부 전송 없음(삭제는 로컬 Dexie 트랜잭션만). 골든 코어/db/reconcile/storeOps 미변경.
- `repo.deletePhotos` 5테이블 rw 트랜잭션 원자성 + thumbs bulkDelete로 썸네일 누수 없음. 빈 ids no-op.
- objectURL 생명주기(useThumbUrls·PhotoMapView): 취소 가드 + cleanup 전량 revoke → 누수 없음.
- 비가역 삭제는 ConfirmDialog 확인 필수(우발 삭제 방지). userOverride(가고싶음)·sido·trips·home 보존.
