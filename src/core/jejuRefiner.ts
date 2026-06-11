// src/core/jejuRefiner.ts — 제주 좌표 → 읍·면·동 코드(2차 레이어, 순수·결정적).
// 코어(regionMatcher/pointInPolygon) 미수정. pointInMultiPolygon SSOT 재사용.
// ⚠ 아래 distanceToBoundary/ringDist/segDist 는 RegionMatcher.distancePointToSegment(private,
//   regionMatcher.ts:150-174)와 **연산 순서까지 byte-동일**해야 경계 타이브레이크가 코어와 일치한다.
//   float 연산 순서(곱→나눗셈→덧셈) 변경 금지. 특히 제곱은 `**` 아닌 `x*x`(코어와 동일, ULP 차이 방지).
//   코어 메서드가 private라 직접 호출 불가 → 재구현 유지.
// pointInMultiPolygon 은 config 옵셔널(기본 leftBottomInclusive) — base 매처와 동일 기본값 사용.
import type { Coordinate, MultiPolygon } from './geoTypes';
import { pointInMultiPolygon } from './pointInPolygon';

export interface JejuDong {
  code: string; // adm_cd2 10자리
  mp: MultiPolygon;
}

/**
 * 제주 좌표 → 동 코드. 포함하는 동 중 코드 오름차순 최소(base 매처 동작 미러).
 * 포함 0개면 경계 최단거리 동(임계값 없음 — 호출측이 이미 제주임을 확인). 목록 비면 null.
 */
export function refineJeju(coord: Coordinate, dongs: readonly JejuDong[]): string | null {
  const contained: string[] = [];
  for (const d of dongs) {
    if (pointInMultiPolygon(coord, d.mp)) contained.push(d.code);
  }
  if (contained.length > 0) {
    let best = contained[0];
    for (const c of contained) if (c < best) best = c;
    return best;
  }
  let bestCode: string | null = null;
  let bestDist = Number.MAX_VALUE;
  for (const d of dongs) {
    const dist = distanceToBoundary(coord, d.mp);
    // 동률 시 코드 최소(코어 line 96 타이브레이크 동작 미러).
    if (dist < bestDist || (dist === bestDist && (bestCode === null || d.code < bestCode))) {
      bestDist = dist;
      bestCode = d.code;
    }
  }
  return bestCode;
}

/** MultiPolygon 모든 링 변까지 최단거리(m). RegionMatcher.distanceToBoundary 동일 공식의 순수 재구현. */
function distanceToBoundary(p: Coordinate, mp: MultiPolygon): number {
  let best = Number.MAX_VALUE;
  for (const poly of mp.polygons) {
    best = Math.min(best, ringDist(p, poly.outer));
    for (const hole of poly.holes) best = Math.min(best, ringDist(p, hole));
  }
  return best;
}
function ringDist(p: Coordinate, ring: Coordinate[]): number {
  const n = ring.length;
  if (!(n >= 2)) return Number.MAX_VALUE;
  let best = Number.MAX_VALUE;
  for (let i = 0; i < n; i++) best = Math.min(best, segDist(p, ring[i], ring[(i + 1) % n]));
  return best;
}
/** 점-선분 최단거리(m). RegionMatcher.distancePointToSegment(line 150-174)와 byte-동일. */
function segDist(p: Coordinate, a: Coordinate, b: Coordinate): number {
  const r = 6_371_000.0; // 지구 반경(m).
  const degToRad = Math.PI / 180.0;
  const kx = Math.cos(p.lat * degToRad) * degToRad * r; // m/도(경도) @ 질의점 위도.
  const ky = degToRad * r; // m/도(위도).

  const px = p.lon * kx;
  const py = p.lat * ky;
  const ax = a.lon * kx;
  const ay = a.lat * ky;
  const bx = b.lon * kx;
  const by = b.lat * ky;

  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy;
  let t: number;
  if (l2 === 0) {
    t = 0; // 길이 0 변 → 끝점 거리.
  } else {
    t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
  }
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.sqrt((px - cx) * (px - cx) + (py - cy) * (py - cy));
}
