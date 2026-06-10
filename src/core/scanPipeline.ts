// src/core/scanPipeline.ts
//
// Swift BaljachwiCore/ScanPipeline.swift 의 byte-faithful 포트.
//
// 스캔 결과를 받아 지역매칭 + 타임존 + 여행분리 + 지역집계를 한 번에 수행하는
// 순수 통합 파이프라인. 결과는 plain 값타입(PipelineResult)만 반환한다.
//
// 설계 원칙:
//  - 순수·결정적. 네트워크/디스크/시스템시계/난수 없음. 입력 순서 보존.
//  - 기존 SSOT 알고리즘(tzOffset / RegionMatcher / segment / representativeRegionCode)을
//    재구현하지 않고 배선만 한다.
//  - 시간은 epoch 초(number) 정수 산술만. JS Date 객체/타임존 메서드 금지.

import type { Coordinate, BBox } from './geoTypes';
import type { ScannedPhoto } from './photoScan'; // { localIdentifier, lat, lon, takenAt(epoch초) }
import type { RegionMatcher } from './regionMatcher'; // matcher.regionCode(coord): string | null
import { tzOffset, defaultTZConfig, type TZConfig } from './photoTime';
import {
  segment,
  makeSegmentConfig,
  type SegmentConfig,
  type PhotoSample,
} from './tripSegmenter';
import { representativeRegionCode } from './tripMetrics';

// ── 결과 값타입 ──

/** 파이프라인 처리 후 사진 1장. 입력 ScannedPhoto + 파생정보(타임존/지역/여행). */
export interface PipelinePhoto {
  localIdentifier: string;
  lat: number;
  lon: number;
  /** epoch 초 (Swift Date → number) */
  takenAt: number;
  /** 현지 타임존 오프셋(초, UTC 동쪽 양수) */
  localTZoffsetSeconds: number;
  /** MOIS SIG_CD. 매칭 실패(해외/바다) 시 null */
  regionCode: string | null;
  /** 소속 여행 id. 어느 여행에도 속하지 않으면 null */
  tripID: string | null;
  /** 소속 여행 내 takenAt 오름차순 인덱스(0,1,2...). 여행 없으면 0 */
  sortIndex: number;
}

/** 지역 단위 방문 집계. regionCode가 null인 사진(해외)은 집계 제외. */
export interface PipelineRegion {
  regionCode: string;
  photoCount: number;
  firstVisit: number; // epoch 초
  lastVisit: number; // epoch 초
}

/** 여행 1개. TripSegmenter Trip + 결정적 id + 대표 지역코드. */
export interface PipelineTrip {
  /** 결정적 id: `${Math.trunc(startAt)}_${sampleIDs[0] ?? ""}` */
  id: string;
  /** 소속 사진 id(takenAt 오름차순, 동률 시 id 안정정렬 — tripSegmenter가 보장) */
  sampleIDs: string[];
  startAt: number; // epoch 초
  endAt: number; // epoch 초
  bbox: BBox;
  /** 여행 사진 regionCode 최빈값(동률 시 regionCode 오름차순 최소; 전부 null이면 null) */
  representativeRegionCode: string | null;
}

/** 파이프라인 전체 결과. */
export interface PipelineResult {
  photos: PipelinePhoto[]; // 입력 순서 보존
  regions: PipelineRegion[]; // regionCode 오름차순
  trips: PipelineTrip[]; // startAt 오름차순, 동률 시 id 오름차순
  home: Coordinate | null; // SegmentResult.home 그대로
}

// ── ScanPipeline ──

/**
 * 스캔 결과 통합 처리(순수·결정적). Swift ScanPipeline.build 1:1.
 *
 * 처리 순서:
 *  1) 각 사진의 타임존 오프셋·regionCode 결정.
 *  2) PhotoSample 구성 → segment.
 *  3) 각 Trip에 결정적 id 부여.
 *  4) PipelinePhoto 조립(regionCode + tripID + sortIndex, 입력 순서 보존).
 *  5) PipelineRegion 집계(regionCode 오름차순).
 *  6) PipelineTrip 조립(대표 지역코드, startAt 오름차순).
 *  7) home은 SegmentResult.home 그대로.
 *
 * excludedTripSampleIDs: 핀된 사진 id — 트립 세그먼테이션에서만 제외(유령 auto-trip 방지).
 * photos/regions/home은 전체 스캔 기준 유지. 기본 빈 Set.
 */
export function buildScanPipeline(
  scanned: readonly ScannedPhoto[],
  matcher: RegionMatcher,
  deviceOffsetSeconds: number,
  segmentConfig: SegmentConfig = makeSegmentConfig(),
  tzConfig: TZConfig = defaultTZConfig(),
  excludedTripSampleIDs: ReadonlySet<string> = new Set<string>(),
): PipelineResult {
  // 1) 사진별 타임존·지역 결정. MVP 스캔은 EXIF 오프셋이 없으므로 exifOffsetSeconds=null.
  interface Derived {
    scanned: ScannedPhoto;
    coordinate: Coordinate;
    tz: number;
    regionCode: string | null;
  }
  const derived: Derived[] = scanned.map((p) => {
    const coord: Coordinate = { lat: p.lat, lon: p.lon };
    const tz = tzOffset(coord, null, deviceOffsetSeconds, tzConfig);
    return { scanned: p, coordinate: coord, tz, regionCode: matcher.regionCode(coord) };
  });

  // 2) PhotoSample 구성 → 여행 분리.
  const samples: PhotoSample[] = derived.map((d) => ({
    id: d.scanned.localIdentifier,
    coordinate: d.coordinate,
    takenAt: d.scanned.takenAt,
    localTZoffsetSeconds: d.tz,
  }));
  const seg = segment(samples, segmentConfig, excludedTripSampleIDs);

  // regionCode 조회용 맵(사진 id → regionCode).
  // localIdentifier 중복은 first-wins dedup과 일관되게 첫 값 유지(Dictionary uniquingKeysWith:first).
  const regionByID = new Map<string, string | null>();
  for (const d of derived) {
    const id = d.scanned.localIdentifier;
    if (!regionByID.has(id)) regionByID.set(id, d.regionCode);
  }

  // 3) 각 Trip의 결정적 id를 1회 생성하고, 4)·6)에서 공유한다.
  // sampleID → (tripID, sortIndex) 맵. sampleIDs는 이미 takenAt 오름차순(동률 id 안정정렬).
  const tripMembership = new Map<string, { tripID: string; sortIndex: number }>();
  const tripIDByTrip: string[] = []; // seg.trips 인덱스 → 결정적 id
  seg.trips.forEach((trip, tIdx) => {
    // Swift Int(timeIntervalSince1970)은 0방향 절삭 → Math.trunc.
    const id = `${Math.trunc(trip.startAt)}_${trip.sampleIDs[0] ?? ''}`;
    tripIDByTrip[tIdx] = id;
    trip.sampleIDs.forEach((sid, sortIndex) => {
      tripMembership.set(sid, { tripID: id, sortIndex });
    });
  });

  // 4) PipelinePhoto 조립(입력 순서 보존).
  const photos: PipelinePhoto[] = derived.map((d) => {
    const membership = tripMembership.get(d.scanned.localIdentifier);
    return {
      localIdentifier: d.scanned.localIdentifier,
      lat: d.scanned.lat,
      lon: d.scanned.lon,
      takenAt: d.scanned.takenAt,
      localTZoffsetSeconds: d.tz,
      regionCode: d.regionCode,
      tripID: membership?.tripID ?? null,
      sortIndex: membership?.sortIndex ?? 0,
    };
  });

  // 5) PipelineRegion 집계(regionCode != null만, regionCode 오름차순).
  const byRegion = new Map<string, { count: number; first: number; last: number }>();
  for (const d of derived) {
    const code = d.regionCode;
    if (code === null) continue;
    const t = d.scanned.takenAt;
    const agg = byRegion.get(code);
    if (agg !== undefined) {
      agg.count += 1;
      agg.first = Math.min(agg.first, t);
      agg.last = Math.max(agg.last, t);
    } else {
      byRegion.set(code, { count: 1, first: t, last: t });
    }
  }
  const regions: PipelineRegion[] = Array.from(byRegion.entries())
    .map(([regionCode, v]) => ({
      regionCode,
      photoCount: v.count,
      firstVisit: v.first,
      lastVisit: v.last,
    }))
    // regionCode 오름차순 — Swift String `<`(유니코드 코드포인트 비교)와 동일(localeCompare 금지).
    .sort((a, b) => (a.regionCode < b.regionCode ? -1 : a.regionCode > b.regionCode ? 1 : 0));

  // 6) PipelineTrip 조립(대표 지역코드, startAt 오름차순).
  // seg.trips는 시간순으로 생성되지만, 결정성을 위해 startAt 오름차순으로 명시 정렬한다.
  const pipelineTrips: PipelineTrip[] = seg.trips
    .map((trip, tIdx) => {
      const id = tripIDByTrip[tIdx];
      // 이중 옵셔널 평탄화: get은 undefined(키 없음) 또는 null(매칭 실패) 둘 다 가능 → != null 로 둘 다 거름.
      const codes = trip.sampleIDs
        .map((sid) => regionByID.get(sid))
        .filter((c): c is string => c != null);
      const rep = representativeRegionCode(codes);
      return {
        id,
        sampleIDs: trip.sampleIDs,
        startAt: trip.startAt,
        endAt: trip.endAt,
        bbox: trip.bbox,
        representativeRegionCode: rep,
      };
    })
    .sort((a, b) => {
      const t0 = a.startAt;
      const t1 = b.startAt;
      if (t0 !== t1) return t0 - t1;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });

  // 7) home은 그대로.
  return { photos, regions, trips: pipelineTrips, home: seg.home };
}
