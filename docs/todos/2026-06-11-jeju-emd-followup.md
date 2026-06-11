# 제주 읍면동 세분화 리뷰 후속 (2026-06-11)

> 멀티에이전트 리뷰(Code Reviewer + Security Engineer 병렬) + 각 발견 적대적 검증 결과.
> 원시 6건 → 적대적 검증 통과 2건(모두 Low). 대상 커밋: b35d128 ~ e0e94ae (제주 읍면동 세분화 6커밋).

## 반영 완료 (이번 작업)

- **[security · scripts/build-jeju-emd.mjs] KOGL 출처표시 누락** (Medium→Low) — vuski/admdongkor(KOGL 제1유형) 데이터가 `assets/geo/jeju-emd.geojson`·`public/geo/jeju-emd.geojson`로 git 추적·재배포되는데 배포물/사용자 대면 문서에 출처표시가 없었음(빌드 스크립트 헤더·계획 문서에만 존재). **README.md에 「데이터 출처 / 라이선스 고지」 섹션 추가**로 KOGL 제1유형 출처표시 의무 충족.
  - 비고: geojson 파일 자체에는 top-level `source`/`license` 키를 넣지 않음 — `tests/data/jejuEmd.test.ts`가 top-level 키를 `{type, features}`만으로 단정하므로. 출처표시는 README 고지로 충족(KOGL은 매체 무관 출처표시 인정).

## 이관 (이후 세션)

### Low

- **[code-review · src/core/jejuRefiner.ts] 거리 공식 수기 중복 — 코어 변경 시 drift 위험** — `segDist`/`ringDist`/`distanceToBoundary`가 `RegionMatcher`의 private 거리 메서드(`regionMatcher.ts:150-174`)를 손으로 재구현. **현재 byte-동일 확인됨**(연산 순서 곱→나눗셈→덧셈 일치, 제곱 `x*x` 사용, 타이브레이크 코드 최소 미러). 다만 코어 공식이 바뀌면 자동으로 따라가지 않음.
  - **즉시 수정 안 하는 이유**: 코어 메서드가 private이고 코어는 byte-faithful 불변(0줄 수정) 원칙 → (a) 코어에서 거리 util을 export하면 골든 불변 위반, (b) 테스트에 공식을 또 복제하면 그 테스트 자체가 세 번째 drift 소스가 됨. 완전한 일치-강제 테스트가 제약상 불가.
  - **현 완화책**: `jejuRefiner.ts:3-6` ⚠ 불변식 주석(연산 순서·`x*x`·코어 라인 참조 명시) + `tests/core/jejuRefiner.test.ts`의 126.16 경계 타이브레이크 특성화 테스트(공식이 크게 어긋나면 깨짐).
  - **후속 개선안(택1)**: ① 코어 다음 byte-faithful 재포팅 시점에 거리 계산을 `src/core` 비골든 순수 util(예: `geoDistance.ts`)로 분리하고 `RegionMatcher`와 `jejuRefiner`가 공유(코어 리포팅과 함께라야 골든 무영향). ② iOS 코어에 동일 분리가 반영될 때 맞춰 동기화. 현 규모(드문 변경·Low 영향)에선 주석+특성화 테스트 유지가 합리적.

## 비고

- 적대적 검증에서 기각된 4건(원시 6 − 확정 2)은 실 위험 없음으로 종결.
- `src/core/*` 골든(regionMatcher/pointInPolygon 등) 미변경 — 회귀 없음. `JejuRefiningMatcher`는 subclass 데코레이터라 base 매처 동작 불변.
- 분모 296 = 255 시군구 − 제주시/서귀포시 2 + 제주 읍면동 43. `levelLayerConfig('sigungu').total`이 유일한 하드코딩 분모.
