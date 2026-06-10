// src/core/regionMatcher.ts
//
// Swift BaljachwiCore/RegionMatcher.swift 의 byte-faithful 포트.
//
// 좌표 → MOIS SIG_CD(regionCode) 매칭(순수·결정적).
//
// 결정 규칙(순서):
//  1. 한국 bbox 프리필터 — lat∈[33.0,38.9] AND lon∈[124.6,132.0]이 아니면 null.
//     (0,0)·해외 좌표를 폴리곤 테스트 전에 배제한다.
//  2. 후보 축소 — sigungu 엔트리 중 entry.bbox가 점을 포함하는 것만.
//  3. 히트테스트 — 각 후보에 pointInMultiPolygon SSOT를 재사용(직접 재구현하지 않음).
//  4. 동률·경계 결정성
//     - 포함 후보 ≥1개 → regionCode 오름차순 최소 반환.
//     - 포함 0개 → bbox 후보들의 폴리곤 경계까지 최단거리(m) 계산, ≤100m면
//       가장 가까운(동률 시 regionCode 최소) 후보 반환, 그 외 null.
//  5. 후보 자체가 없으면 null.

import type { Coordinate, MultiPolygon } from './geoTypes';
import { pointInMultiPolygon } from './pointInPolygon';
import { GeoDataStore, type RegionCodeEntry } from './geoDataStore';

export class RegionMatcher {
  /** 한국 bbox 프리필터 경계. */
  private static readonly minLat = 33.0;
  private static readonly maxLat = 38.9;
  private static readonly minLon = 124.6;
  private static readonly maxLon = 132.0;

  /** 경계 흡수 임계(미터). */
  private static readonly boundaryAbsorbMeters = 100.0;

  private readonly store: GeoDataStore;

  /** 시군구 엔트리만 미리 추려둔다(시도 코드가 후보에 섞여 polygon이 undefined인 것을 방지). */
  private readonly sigunguEntries: RegionCodeEntry[];

  constructor(store: GeoDataStore) {
    this.store = store;
    this.sigunguEntries = store.entries.filter((e) => e.level === 'sigungu');
  }

  regionCode(coordinate: Coordinate): string | null {
    // 1. 한국 bbox 프리필터 (양끝 포함).
    if (
      !(RegionMatcher.minLat <= coordinate.lat && coordinate.lat <= RegionMatcher.maxLat) ||
      !(RegionMatcher.minLon <= coordinate.lon && coordinate.lon <= RegionMatcher.maxLon)
    ) {
      return null;
    }

    // 2. bbox 후보 축소(시군구만). bbox = [minLon, minLat, maxLon, maxLat]. 양끝 포함.
    const candidates = this.sigunguEntries.filter((entry) => {
      const b = entry.bbox;
      return (
        b[0] <= coordinate.lon &&
        coordinate.lon <= b[2] &&
        b[1] <= coordinate.lat &&
        coordinate.lat <= b[3]
      );
    });
    if (candidates.length === 0) {
      return null;
    }

    // 3. 히트테스트 — 포함하는 후보 수집.
    const contained: string[] = [];
    for (const entry of candidates) {
      // 후보는 시군구 엔트리이므로 폴리곤이 반드시 존재한다(force-unwrap 안전).
      // Swift store.polygon(for:)! 의미 보존: undefined면 명시 throw(정상 데이터에서는 도달 불가).
      const mp = this.polygonOrThrow(entry.regionCode);
      if (pointInMultiPolygon(coordinate, mp)) {
        contained.push(entry.regionCode);
      }
    }

    // 4-a. 포함 후보 ≥1개 → regionCode 오름차순 최소.
    //   Swift contained.min() — regionCode는 ASCII 숫자 5자리이므로 JS `<` 사전순과 동일.
    if (contained.length > 0) {
      let best = contained[0];
      for (const code of contained) {
        if (code < best) {
          best = code;
        }
      }
      return best;
    }

    // 4-b. 포함 0개 → 경계 최단거리 ≤100m면 가장 가까운 후보(동률 시 코드 최소).
    let bestCode: string | null = null;
    let bestDist = Number.MAX_VALUE; // Swift Double.greatestFiniteMagnitude (Infinity 아님).
    for (const entry of candidates) {
      const mp = this.polygonOrThrow(entry.regionCode);
      const d = this.distanceToBoundary(coordinate, mp);
      // 동률 시 regionCode 최소를 택하기 위해 strict-less 또는 코드 비교로만 갱신
      // (candidates를 코드 오름차순 순회한다는 보장이 없으므로 코드 비교로 타이브레이크).
      if (d < bestDist || (d === bestDist && (bestCode === null || entry.regionCode < bestCode))) {
        bestDist = d;
        bestCode = entry.regionCode;
      }
    }
    if (bestCode !== null && bestDist <= RegionMatcher.boundaryAbsorbMeters) {
      return bestCode;
    }

    // 5. 그 외 null.
    return null;
  }

  // ── 폴리곤 조회(force-unwrap 의미 보존) ─────────────────────────────

  /** Swift store.polygon(for:)! 대응 — 후보=시군구 불변식으로 정상 데이터에선 도달 불가. */
  private polygonOrThrow(regionCode: string): MultiPolygon {
    const mp = this.store.polygon(regionCode);
    if (mp === undefined) {
      throw new Error(`RegionMatcher: polygon missing for sigungu regionCode ${regionCode}`);
    }
    return mp;
  }

  // ── 경계 거리(미터) ─────────────────────────────────────────────────

  /** 점에서 MultiPolygon의 모든 링(외곽+홀) 변까지 최단거리(m). */
  private distanceToBoundary(point: Coordinate, multiPolygon: MultiPolygon): number {
    let best = Number.MAX_VALUE;
    for (const polygon of multiPolygon.polygons) {
      best = Math.min(best, this.distanceToRing(point, polygon.outer));
      for (const hole of polygon.holes) {
        best = Math.min(best, this.distanceToRing(point, hole));
      }
    }
    return best;
  }

  /** 점에서 닫힌 링의 각 변(선분)까지 최단거리(m). */
  private distanceToRing(point: Coordinate, ring: Coordinate[]): number {
    const n = ring.length;
    if (!(n >= 2)) {
      return Number.MAX_VALUE;
    }
    let best = Number.MAX_VALUE;
    for (let i = 0; i < n; i++) {
      const a = ring[i];
      const b = ring[(i + 1) % n]; // 마지막 점 → 첫 점으로 닫음.
      best = Math.min(best, this.distancePointToSegment(point, a, b));
    }
    return best;
  }

  /** 점-선분 최단거리(m). 등거리 근사 평면(질의점 위도 cos 보정) 사용. */
  private distancePointToSegment(p: Coordinate, a: Coordinate, b: Coordinate): number {
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
}
