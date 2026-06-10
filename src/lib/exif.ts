// src/lib/exif.ts — 브라우저 EXIF 추출(exifr). UI/IO 경계 — 여기서만 EXIF 원문을 다룬다.
//
// 핵심: exifr의 Date revive는 OffsetTimeOriginal 부재 시 "실행 머신 로컬 TZ"로 해석한다(비결정적).
// 그래서 reviveValues:false 로 원문 문자열을 직접 파싱하고, 오프셋을 명시 적용해 epoch 초를 만든다.
//   takenAt = (wall time을 UTC로 본 epoch) − offsetSeconds
//   offsetSeconds = OffsetTimeOriginal(있으면) else deviceOffsetSeconds(폴백)
// Date.UTC는 순수 달력 산술(시스템 클럭·로컬 TZ 비참조)이라 결정적 — core의 Date 금지와 무관.

import exifr from 'exifr';
import type { RawPhotoAsset } from '@/core/photoScan';

/** exifr가 받는 입력(브라우저 File/Blob, Node Buffer/ArrayBuffer 등). */
type ExifInput = Parameters<typeof exifr.parse>[0];

export interface ExtractedExif {
  latitude: number | null;
  longitude: number | null;
  /** epoch 초. DateTimeOriginal 없으면 null. */
  takenAtEpoch: number | null;
}

/** "+09:00" / "-08:00" / "Z" → 오프셋 초. 파싱 실패 시 null. */
function parseOffset(raw: unknown): number | null {
  if (typeof raw !== 'string') return null;
  const s = raw.trim();
  if (s === 'Z' || s === 'z') return 0;
  const m = /^([+-])(\d{2}):?(\d{2})$/.exec(s);
  if (!m) return null;
  const sign = m[1] === '-' ? -1 : 1;
  return sign * (Number(m[2]) * 3600 + Number(m[3]) * 60);
}

/** "YYYY:MM:DD HH:MM:SS"(EXIF 표준) wall time + 오프셋초 → epoch 초. 파싱 실패 시 null. */
function wallTimeToEpoch(raw: unknown, offsetSeconds: number): number | null {
  if (typeof raw !== 'string') return null;
  const m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(raw.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  const asUTC = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s));
  return Math.trunc(asUTC / 1000) - offsetSeconds;
}

/**
 * EXIF에서 GPS·촬영시각 추출. takenAt은 epoch 초.
 * @param input exifr 입력(File/Blob/Buffer)
 * @param deviceOffsetSeconds OffsetTimeOriginal 부재 시 적용할 폴백 오프셋(초)
 */
export async function extractExif(
  input: ExifInput,
  deviceOffsetSeconds: number,
): Promise<ExtractedExif> {
  // 원문 문자열(revive 금지) — 시간 결정성. GPS는 exifr.gps로 십진 변환.
  const [raw, gps] = await Promise.all([
    exifr
      .parse(input, { reviveValues: false, pick: ['DateTimeOriginal', 'OffsetTimeOriginal'] })
      .catch(() => null),
    exifr.gps(input).catch(() => null),
  ]);

  const latitude = gps && typeof gps.latitude === 'number' ? gps.latitude : null;
  const longitude = gps && typeof gps.longitude === 'number' ? gps.longitude : null;

  let takenAtEpoch: number | null = null;
  if (raw && raw.DateTimeOriginal) {
    const exifOffset = parseOffset(raw.OffsetTimeOriginal);
    const offset = exifOffset !== null ? exifOffset : deviceOffsetSeconds;
    takenAtEpoch = wallTimeToEpoch(raw.DateTimeOriginal, offset);
  }

  return { latitude, longitude, takenAtEpoch };
}

/** File 메타데이터로 안정 식별자 생성(FNV-1a). PHAsset id 없는 웹의 dedup·썸네일 키. */
export function fileLocalIdentifier(file: {
  name: string;
  size: number;
  lastModified: number;
}): string {
  const key = `${file.name}:${file.size}:${file.lastModified}`;
  let h = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193); // FNV prime
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** File → RawPhotoAsset(필터 전 메타). exif 추출 + 식별자. */
export async function fileToRawAsset(
  file: File,
  deviceOffsetSeconds: number,
): Promise<RawPhotoAsset> {
  const { latitude, longitude, takenAtEpoch } = await extractExif(file, deviceOffsetSeconds);
  return {
    localIdentifier: fileLocalIdentifier(file),
    latitude,
    longitude,
    takenAtEpoch,
  };
}
