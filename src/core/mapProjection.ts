// src/core/mapProjection.ts
// Swift BaljachwiCore/MapProjection.swift 의 byte-faithful 포트.
// 순수·결정적 모듈 — Date/IO/전역 가변상태 없음. 의존은 geoTypes의 Coordinate{lat,lon}뿐.
import type { Coordinate } from './geoTypes';

/** CGPoint 대응. 화면 좌표(pt). */
export interface ScreenPoint {
  x: number;
  y: number;
}

/**
 * 등거리 정투영 파라미터.
 * 좌표계 규약(SSOT): 원점 = bbox 좌상단 (minLon, maxLat) → (0,0).
 * x: 동(+lon) → 오른쪽. y: Y반전 — 북(maxLat)이 y=0, 남쪽으로 y 증가.
 */
export interface ProjectionConfig {
  /** bbox 서단 경도(도). 화면 x=0 기준. */
  minLon: number;
  /** bbox 북단 위도(도). 화면 y=0 기준(Y반전 기준점). */
  maxLat: number;
  /** 경도 cos 보정 기준 위도(도). 기본 36.0(한국 중심). */
  refLat: number;
  /** 균일 스케일(pt/도). 0이면 unproject 비가역 → null. */
  scale: number;
}

export const DEFAULT_REF_LAT = 36.0;

/** Swift init 기본값 refLat=36.0 대응 팩토리. */
export function makeProjectionConfig(args: {
  minLon: number;
  maxLat: number;
  refLat?: number; // 생략 시 DEFAULT_REF_LAT(36.0)
  scale: number;
}): ProjectionConfig {
  return {
    minLon: args.minLon,
    maxLat: args.maxLat,
    refLat: args.refLat ?? DEFAULT_REF_LAT,
    scale: args.scale,
  };
}

/** Swift computed var lonScaleFactor 대응: cos(refLat° → rad). */
export function lonScaleFactor(config: ProjectionConfig): number {
  return Math.cos((config.refLat * Math.PI) / 180.0);
}

/**
 * 정투영(전사·total).
 * x = (lon − minLon) · cos(refLat°) · scale
 * y = (maxLat − lat) · scale
 */
export function project(coordinate: Coordinate, config: ProjectionConfig): ScreenPoint {
  const x = (coordinate.lon - config.minLon) * lonScaleFactor(config) * config.scale;
  const y = (config.maxLat - coordinate.lat) * config.scale;
  return { x, y };
}

/**
 * 역투영. project의 정확한 역연산.
 * lon = x / (cos(refLat°)·scale) + minLon ; lat = maxLat − y / scale
 * 비가역 방어: scale === 0 또는 lonDenom === 0 이면 null (Swift nil 대응).
 */
export function unproject(point: ScreenPoint, config: ProjectionConfig): Coordinate | null {
  const lonDenom = lonScaleFactor(config) * config.scale;
  if (config.scale === 0 || lonDenom === 0) return null;
  const lon = point.x / lonDenom + config.minLon;
  const lat = config.maxLat - point.y / config.scale;
  return { lat, lon };
}
