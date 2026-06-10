// src/core/tripSegmenter.ts
//
// Swift BaljachwiCore/TripSegmenter.swift 의 byte-faithful 포트.
// 시간은 전부 epoch 초(number) — JS Date 객체 금지. 정수 산술은 Math.floor 기반(Math.trunc 금지).
import type { Coordinate, BBox } from './geoTypes';

// ── 입력/출력 타입 ──

/** 여행 분리 입력 단위. 시간은 전부 epoch 초(number) — JS Date 금지. */
export interface PhotoSample {
  /** 안정 키(정렬 tie-break에도 사용). */
  id: string;
  coordinate: Coordinate;
  /** 절대 촬영 시각, UTC epoch 초 (Swift Date.timeIntervalSince1970 대응). */
  takenAt: number;
  /** 현지 타임존 오프셋(초). 예: KST=+32400, 파리(겨울)=+3600. */
  localTZoffsetSeconds: number;
}

/** 여행 1개. sampleIDs는 절대시각 오름차순. */
export interface Trip {
  sampleIDs: string[];
  /** epoch 초 */
  startAt: number;
  /** epoch 초 */
  endAt: number;
  bbox: BBox; // {minLat,minLon,maxLat,maxLon}
}

export interface SegmentResult {
  trips: Trip[];
  /** 탐지된 home 좌표(없으면 null). */
  home: Coordinate | null;
}

/** 임계값 전부 주입형. 기본값은 makeSegmentConfig 참조. */
export interface SegmentConfig {
  jumpKM: number; // ③ home 점프 분리 거리(km)
  gapHours: number; // ④ 시간 gap 분리(h)
  homeSuppressionRadiusKM: number; // home 근처 판정 반경(km)
  stayShiftKM: number; // home nil 폴백 체류지 이동(km)
  nightStartHour: number; // 야간 시작(포함)
  nightEndHour: number; // 야간 끝(미포함)
  minHomeNights: number; // home 성립 최소 서로 다른 현지 날짜 수
  burstMeters: number; // burst 거리(m)
  burstSeconds: number; // burst 시간(초)
  homeClusterRadiusKM: number; // 야간 위치 그리디 군집 반경(km)
  trivialMinPhotos: number; // 사진 수 미만 → trivial
  trivialRadiusKM: number; // AND-절 반경(km)
  trivialDurationHours: number; // AND-절 지속(h)
}

/** Swift SegmentConfig() 기본 생성자 대응 — partial 오버라이드 허용. */
export function makeSegmentConfig(overrides?: Partial<SegmentConfig>): SegmentConfig {
  return {
    jumpKM: 90,
    gapHours: 8,
    homeSuppressionRadiusKM: 18,
    stayShiftKM: 40,
    nightStartHour: 21,
    nightEndHour: 6,
    minHomeNights: 3,
    burstMeters: 50,
    burstSeconds: 120,
    homeClusterRadiusKM: 18,
    trivialMinPhotos: 2,
    trivialRadiusKM: 5,
    trivialDurationHours: 4,
    ...overrides,
  };
}

// ── 상수 ──
const EARTH_RADIUS_METERS = 6_371_000.0;
const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_DAY = 86400;
const KM_TO_METERS = 1000;

/**
 * 사진들을 여행 단위로 분리. 순수·결정적.
 * 순서: (1)절대시각+id 정렬 → (2)burst dedupe → (3)home 탐지(전체 deduped 기준)
 *      → (3.5)excludedTripSampleIDs 제외 → (4)인접쌍 분리 → (5)trivial 제거 + 조건부 home-area 억제.
 * excludedTripSampleIDs 기본 빈 Set — home 탐지에는 영향 없음(트립 생성에서만 제외).
 */
export function segment(
  samples: PhotoSample[],
  config: SegmentConfig = makeSegmentConfig(),
  excludedTripSampleIDs: ReadonlySet<string> = new Set<string>(),
): SegmentResult {
  // (1) 절대시각 정렬. 동률은 id 안정 정렬로 결정성 확보(코드포인트 비교, localeCompare 금지).
  const sorted = [...samples].sort((a, b) => {
    if (a.takenAt !== b.takenAt) return a.takenAt - b.takenAt;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  // (2) burst dedupe.
  const deduped = burstDedupe(sorted, config);

  if (deduped.length === 0) {
    return { trips: [], home: null };
  }

  // (3) home 탐지 — 전체 deduped 기준(핀 제외 영향 없음).
  const home = detectHome(deduped, config);

  // (3.5) 트립 생성용 집합 — 핀 사진 제외(home 탐지 이후라 home은 전체 기준 유지).
  const forTrips =
    excludedTripSampleIDs.size === 0
      ? deduped
      : deduped.filter((s) => !excludedTripSampleIDs.has(s.id));
  if (forTrips.length === 0) {
    return { trips: [], home };
  }

  // (4) 인접쌍 분리 → 런(run) 경계 산출.
  const runs: PhotoSample[][] = [];
  let current: PhotoSample[] = [forTrips[0]];
  for (let i = 0; i < forTrips.length - 1; i++) {
    if (shouldSplit(forTrips, i, home, config)) {
      runs.push(current);
      current = [forTrips[i + 1]];
    } else {
      current.push(forTrips[i + 1]);
    }
  }
  runs.push(current);

  // (5) 사소(trivial) 제거 후, home-area 억제를 백스톱 조건부로 적용.
  const nonTrivial = runs.filter((run) => !isTrivial(run, config));

  // 모든 비사소 세그먼트가 home 반경 내라면 억제를 건너뛴다(데이터 통째 삭제 방지 백스톱).
  const hasAwayTrip = nonTrivial.some((run) => !isHomeArea(run, home, config));
  const surviving = hasAwayTrip
    ? nonTrivial.filter((run) => !isHomeArea(run, home, config))
    : nonTrivial;
  const trips = surviving.map((run) => makeTrip(run));

  return { trips, home };
}

// ── (2) burst dedupe ──

/** 연속 사진이 앵커(burst 첫 점)로부터 거리≤burstMeters AND Δt≤burstSeconds 이면 버린다(첫 점 대표). */
function burstDedupe(sorted: PhotoSample[], config: SegmentConfig): PhotoSample[] {
  if (sorted.length === 0) return [];
  const first = sorted[0];
  const result: PhotoSample[] = [first];
  let anchor = first;
  for (let i = 1; i < sorted.length; i++) {
    const s = sorted[i];
    const dM = haversineMeters(anchor.coordinate, s.coordinate);
    const dt = Math.abs(s.takenAt - anchor.takenAt);
    if (dM <= config.burstMeters && dt <= config.burstSeconds) {
      // 같은 burst → 버림. 앵커는 유지(첫 점 대표).
      continue;
    } else {
      result.push(s);
      anchor = s;
    }
  }
  return result;
}

// ── (3) home 탐지 ──

interface Cluster {
  centroid: Coordinate;
  coords: Coordinate[];
  days: Set<number>;
}

/** 현지 야간 사진들을 위치로 그리디 군집. ≥minHomeNights 서로 다른 현지 날짜 최빈 클러스터 중심을 home. */
function detectHome(samples: PhotoSample[], config: SegmentConfig): Coordinate | null {
  const nightSamples = samples.filter((s) => isNight(hourOfDay(s), config));
  if (nightSamples.length === 0) return null;

  const clusters: Cluster[] = [];
  for (const s of nightSamples) {
    const day = localDay(s);
    const idx = clusters.findIndex(
      (c) => haversineMeters(c.centroid, s.coordinate) <= config.homeClusterRadiusKM * KM_TO_METERS,
    );
    if (idx !== -1) {
      clusters[idx].coords.push(s.coordinate);
      clusters[idx].days.add(day);
      clusters[idx].centroid = centroidOf(clusters[idx].coords);
    } else {
      clusters.push({ centroid: s.coordinate, coords: [s.coordinate], days: new Set([day]) });
    }
  }

  // 서로 다른 현지 날짜 수 최대(동률은 첫 등장 우선 = strict-greater일 때만 교체).
  let best: Cluster | null = null;
  for (const candidate of clusters) {
    if (best === null || candidate.days.size > best.days.size) {
      best = candidate;
    }
  }
  if (best === null) return null;
  if (best.days.size < config.minHomeNights) return null;
  return best.centroid;
}

// ── (4) 인접쌍 단락평가 분리 ──

/** s[i] 와 s[i+1] 사이를 끊을지 결정. first-match 우선순위 ①→②→③→④→⑤. */
function shouldSplit(
  s: PhotoSample[],
  i: number,
  home: Coordinate | null,
  config: SegmentConfig,
): boolean {
  const a = s[i];
  const b = s[i + 1];
  const distKM = haversineMeters(a.coordinate, b.coordinate) / KM_TO_METERS;
  const gapH = Math.abs(b.takenAt - a.takenAt) / SECONDS_PER_HOUR;

  if (home !== null) {
    const aFar = haversineMeters(a.coordinate, home) / KM_TO_METERS > config.homeSuppressionRadiusKM;
    const bFar = haversineMeters(b.coordinate, home) / KM_TO_METERS > config.homeSuppressionRadiusKM;

    // ① 다일여행 보호: 두 점 모두 home에서 멂 → 비분리.
    if (aFar && bFar) {
      return false;
    }
    // ② 당일치기 보호: 같은 현지 날짜 + 당일 종착 home 복귀 → 비분리(④보다 우선).
    if (localDay(a) === localDay(b) && sameDayTerminatesAtHome(s, i, home, config)) {
      return false;
    }
    // ③ home 점프 분리: home 근처↔멀리 전이 + 거리≥jumpKM → 분리.
    if (aFar !== bFar && distKM >= config.jumpKM) {
      return true;
    }
    // ④ 시간 gap 분리.
    if (gapH > config.gapHours) {
      return true;
    }
    // ⑤ 그 외 비분리.
    return false;
  } else {
    // home == null 폴백: 체류지 이동 ≥stayShiftKM → 분리; 또는 Δt>gapHours → 분리.
    if (distKM >= config.stayShiftKM) return true;
    if (gapH > config.gapHours) return true;
    return false;
  }
}

/** 같은 현지 날짜 윈도우 안에서 마지막 점이 home 반경 내로 복귀하는지(종착 home 복귀). */
function sameDayTerminatesAtHome(
  s: PhotoSample[],
  i: number,
  home: Coordinate,
  config: SegmentConfig,
): boolean {
  const day = localDay(s[i]);
  let lastIdx = i;
  let j = i;
  while (j < s.length && localDay(s[j]) === day) {
    lastIdx = j;
    j += 1;
  }
  const terminal = s[lastIdx];
  return (
    haversineMeters(terminal.coordinate, home) / KM_TO_METERS <= config.homeSuppressionRadiusKM
  );
}

// ── (5) trivial 제거 ──

/** 사소: 사진<trivialMinPhotos OR (반경<trivialRadiusKM AND 지속<trivialDurationHours). */
function isTrivial(run: PhotoSample[], config: SegmentConfig): boolean {
  if (run.length < config.trivialMinPhotos) return true;
  const radiusKM = maxRadiusKM(run);
  const durationH = durationHours(run);
  if (radiusKM < config.trivialRadiusKM && durationH < config.trivialDurationHours) {
    return true;
  }
  return false;
}

/** home-area: home 존재하고 run의 모든 점이 homeSuppressionRadiusKM 이내면 true(home==null이면 false). */
function isHomeArea(run: PhotoSample[], home: Coordinate | null, config: SegmentConfig): boolean {
  if (home === null) return false;
  return run.every(
    (s) => haversineMeters(s.coordinate, home) / KM_TO_METERS <= config.homeSuppressionRadiusKM,
  );
}

// ── Trip 조립 ──

function makeTrip(run: PhotoSample[]): Trip {
  const ids = run.map((s) => s.id);
  const times = run.map((s) => s.takenAt);
  // Swift min()??0 폴백은 비어있지 않은 run에서만 호출되므로 도달 불가 — 형태만 보존.
  const start = times.length > 0 ? Math.min(...times) : 0;
  const end = times.length > 0 ? Math.max(...times) : start;
  const lats = run.map((s) => s.coordinate.lat);
  const lons = run.map((s) => s.coordinate.lon);
  const bbox: BBox = {
    minLat: lats.length > 0 ? Math.min(...lats) : 0,
    minLon: lons.length > 0 ? Math.min(...lons) : 0,
    maxLat: lats.length > 0 ? Math.max(...lats) : 0,
    maxLon: lons.length > 0 ? Math.max(...lons) : 0,
  };
  return { sampleIDs: ids, startAt: start, endAt: end, bbox };
}

// ── 현지시각 헬퍼 (시스템 Calendar 미사용, 정수 epoch 산술) ──

/** 현지 시(0~23). shifted = takenAt + tzOffset. */
export function hourOfDay(s: PhotoSample): number {
  const shifted = s.takenAt + s.localTZoffsetSeconds;
  const h = Math.floor(shifted / SECONDS_PER_HOUR);
  return ((h % 24) + 24) % 24;
}

/** 현지 날짜 버킷. 음수 epoch도 Math.floor로 안전 (Math.trunc 금지). */
export function localDay(s: PhotoSample): number {
  return Math.floor((s.takenAt + s.localTZoffsetSeconds) / SECONDS_PER_DAY);
}

/** 야간 판정. wrap: nightStart>nightEnd 이면 hour>=start || hour<end. 경계: start 포함, end 미포함. */
export function isNight(hour: number, config: SegmentConfig): boolean {
  if (config.nightStartHour <= config.nightEndHour) {
    return hour >= config.nightStartHour && hour < config.nightEndHour;
  }
  return hour >= config.nightStartHour || hour < config.nightEndHour;
}

// ── 기하 헬퍼 ──

/** haversine 거리(m). R=6371000, sqrt 클램프 min(1, sqrt(h)), asin 사용. */
export function haversineMeters(a: Coordinate, b: Coordinate): number {
  const R = EARTH_RADIUS_METERS;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** 좌표 산술 평균(군집 중심). */
function centroidOf(coords: Coordinate[]): Coordinate {
  if (coords.length === 0) return { lat: 0, lon: 0 };
  const n = coords.length;
  const lat = coords.reduce((acc, c) => acc + c.lat, 0) / n;
  const lon = coords.reduce((acc, c) => acc + c.lon, 0) / n;
  return { lat, lon };
}

/** run의 중심으로부터 최대 반경(km). */
function maxRadiusKM(run: PhotoSample[]): number {
  const center = centroidOf(run.map((s) => s.coordinate));
  const dists = run.map((s) => haversineMeters(center, s.coordinate));
  const maxM = dists.length > 0 ? Math.max(...dists) : 0;
  return maxM / KM_TO_METERS;
}

/** run의 시간 지속(시간). */
function durationHours(run: PhotoSample[]): number {
  const times = run.map((s) => s.takenAt);
  if (times.length === 0) return 0;
  const lo = Math.min(...times);
  const hi = Math.max(...times);
  return (hi - lo) / SECONDS_PER_HOUR;
}
