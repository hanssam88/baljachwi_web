#!/usr/bin/env node
// 지오태그 샘플 JPEG 생성기 — 검증용(가져오기→지역지도→경로지도 골든패스).
// 단색 베이스 JPEG에 GPS + DateTimeOriginal(+OffsetTimeOriginal) EXIF를 piexifjs로 주입.
// iOS scripts/make_geotagged.swift 의 웹 대응. 산출물은 samples/(gitignore).
//
// 7장 구성(서울 3·부산 2·제주 2) → 코어 골든 좌표와 교차검증:
//   날짜 gap(44h>8h)·도시 jump(>90km)로 여행 3개 분할, 시군구 7곳 visited.
//
// ⚠ OffsetTimeOriginal(0x9011)은 EXIF 2.31 태그라 piexifjs TAGS 사전에 없을 수 있다.
//   런타임 패치 후 주입 시도, 실패 시 생략 — Korea bbox 좌표는 photoTime이 KST(+32400)를
//   강제하므로 검증 결과는 동일(이 경우 exif.ts의 deviceOffset 폴백 경로가 작동).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import piexif from 'piexifjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '..', 'samples');

// 64x64 단색(연두) baseline JPEG. EXIF 주입 전 베이스 — 차원은 검증에 무관.
const BASE_JPEG_B64 =
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRof' +
  'Hh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCABAAEABAREA/8QAHwAA' +
  'AQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQR' +
  'BRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RF' +
  'RkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ip' +
  'qrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/9oACAEB' +
  'AAA/APf6KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK' +
  'KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK' +
  'KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK' +
  'KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK' +
  'KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK' +
  'KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK' +
  'KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK' +
  'KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK' +
  'KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK' +
  'KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK' +
  'KKKP/2Q==';

// 0x9011 OffsetTimeOriginal 런타임 패치(piexifjs TAGS 사전에 없으면 추가).
let HAS_OFFSET_TAG = false;
try {
  if (piexif.TAGS && piexif.TAGS.Exif && !piexif.TAGS.Exif[0x9011]) {
    piexif.TAGS.Exif[0x9011] = { name: 'OffsetTimeOriginal', type: 'Ascii' };
  }
  HAS_OFFSET_TAG = !!(piexif.TAGS && piexif.TAGS.Exif && piexif.TAGS.Exif[0x9011]);
} catch {
  HAS_OFFSET_TAG = false;
}

/** 십진 도 → piexif rational DMS([[d,1],[m,1],[s*100,100]]). */
function toDMS(deg) {
  const a = Math.abs(deg);
  const d = Math.floor(a);
  const mFloat = (a - d) * 60;
  const m = Math.floor(mFloat);
  const s = (mFloat - m) * 60;
  return [
    [d, 1],
    [m, 1],
    [Math.round(s * 100), 100],
  ];
}

function build(name, lat, lon, dt /* 'YYYY:MM:DD HH:MM:SS' */) {
  const gps = {
    [piexif.GPSIFD.GPSLatitudeRef]: lat >= 0 ? 'N' : 'S',
    [piexif.GPSIFD.GPSLatitude]: toDMS(lat),
    [piexif.GPSIFD.GPSLongitudeRef]: lon >= 0 ? 'E' : 'W',
    [piexif.GPSIFD.GPSLongitude]: toDMS(lon),
  };
  const exifIfd = { [piexif.ExifIFD.DateTimeOriginal]: dt };
  if (HAS_OFFSET_TAG) exifIfd[0x9011] = '+09:00';

  const exifObj = { '0th': {}, Exif: exifIfd, GPS: gps };
  const exifBytes = piexif.dump(exifObj);
  const base = Buffer.from(BASE_JPEG_B64, 'base64').toString('binary');
  const out = piexif.insert(exifBytes, base);
  const buf = Buffer.from(out, 'binary');
  fs.writeFileSync(path.join(OUT_DIR, name), buf);
  return buf.length;
}

// (파일, 위도, 경도, 장소, 기대 regionCode, KST 촬영시각)
const SAMPLES = [
  ['seoul-1.jpg', 37.5663, 126.9779, '2024:04:05 10:00:00'], // 서울시청 → 11140 중구
  ['seoul-2.jpg', 37.5796, 126.977, '2024:04:05 11:30:00'], //  경복궁  → 11110 종로구
  ['seoul-3.jpg', 37.5512, 126.9882, '2024:04:05 14:00:00'], // 남산    → 11170 용산구
  ['busan-1.jpg', 35.1151, 129.0403, '2024:04:07 10:00:00'], // 부산역  → 26170 동구
  ['busan-2.jpg', 35.1587, 129.1604, '2024:04:07 12:00:00'], // 해운대  → 26350 해운대구
  ['jeju-1.jpg', 33.507, 126.493, '2024:04:09 10:00:00'], //   제주공항  → 50110 제주시
  ['jeju-2.jpg', 33.2541, 126.5601, '2024:04:09 11:00:00'], // 서귀포 시청 → 50130 서귀포시
  // (주의) 두 제주 지점 간 거리는 stayShiftKM(40km) 미만이어야 한 여행으로 묶인다.
  //  성산일출봉(126.94)은 공항에서 ~42km라 1장씩 분리→trivial 제거됨 → 서귀포 시청으로 교체.
];

fs.mkdirSync(OUT_DIR, { recursive: true });
console.log(`OffsetTimeOriginal 태그: ${HAS_OFFSET_TAG ? '주입' : '생략(KST 폴백)'}`);
let total = 0;
for (const [name, lat, lon, dt] of SAMPLES) {
  const bytes = build(name, lat, lon, dt);
  total++;
  console.log(`✓ ${name}  (${lat}, ${lon})  ${dt}  ${bytes}B`);
}
console.log(`완료: ${total}/${SAMPLES.length} → ${OUT_DIR}`);
