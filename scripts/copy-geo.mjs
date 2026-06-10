#!/usr/bin/env node
// iOS 코어 번들의 GeoJSON/코드 리소스를 web/public/geo 로 복사한다.
// 매칭용 12MB sigungu.geojson 은 worker 전용, *_display.geojson 은 표시/사전생성 path 원본.
//
// 원본 위치(iOS 클론)는 환경변수 BALJACHWI_IOS_ROOT 로 주입(기본: 형제 폴더 ../baljachwi).
//   예) BALJACHWI_IOS_ROOT=../baljachwi npm run copy-geo
import fs from 'node:fs';
import path from 'node:path';

const IOS_ROOT = process.env.BALJACHWI_IOS_ROOT ?? '../baljachwi';
const SRC_DIR = path.resolve(
  process.cwd(),
  IOS_ROOT,
  'BaljachwiCore/Sources/BaljachwiCore/Resources',
);
const DEST_DIR = path.resolve(process.cwd(), 'public/geo');

const FILES = [
  'region_codes.json',
  'sigungu.geojson',
  'sigungu_display.geojson',
  'sido_display.geojson',
];

if (!fs.existsSync(SRC_DIR)) {
  console.error(`✗ iOS 리소스 폴더를 찾을 수 없습니다: ${SRC_DIR}`);
  console.error(`  BALJACHWI_IOS_ROOT 환경변수로 iOS 클론 경로를 지정하세요(기본 ../baljachwi).`);
  process.exit(1);
}

fs.mkdirSync(DEST_DIR, { recursive: true });

let copied = 0;
for (const name of FILES) {
  const src = path.join(SRC_DIR, name);
  const dest = path.join(DEST_DIR, name);
  if (!fs.existsSync(src)) {
    console.error(`✗ 원본 없음: ${src}`);
    process.exit(1);
  }
  fs.copyFileSync(src, dest);
  const kb = (fs.statSync(dest).size / 1024).toFixed(0);
  console.log(`✓ ${name}  (${kb} KB)`);
  copied++;
}

console.log(`완료: ${copied}/${FILES.length} → ${DEST_DIR}`);
