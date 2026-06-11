#!/usr/bin/env node
// iOS 코어 번들의 GeoJSON/코드 리소스를 web/public/geo 로 복사한다.
// 매칭용 12MB sigungu.geojson 은 worker 전용, *_display.geojson 은 표시/사전생성 path 원본.
//
// 원본 위치(iOS 클론)는 환경변수 BALJACHWI_IOS_ROOT 로 주입(기본: 형제 폴더 ../baljachwi).
//   예) BALJACHWI_IOS_ROOT=../baljachwi npm run copy-geo
import fs from 'node:fs';
import path from 'node:path';
import { spliceJejuDisplay, mergeJejuRegionCodes } from './jejuSplice.mjs';

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

// ── 제주 읍·면·동 세분화 주입 ──────────────────────────────────────
const jejuPath = path.resolve(process.cwd(), 'assets/geo/jeju-emd.geojson');
if (!fs.existsSync(jejuPath)) {
  console.error(`✗ 제주 asset 없음: ${jejuPath} (node scripts/build-jeju-emd.mjs 먼저)`);
  process.exit(1);
}
const jeju = JSON.parse(fs.readFileSync(jejuPath, 'utf8'));

// 1) 표시 geojson 스플라이스(255→296). iOS 원본을 매번 새로 복사 후 스플라이스 → 멱등(누적 없음).
const dispPath = path.join(DEST_DIR, 'sigungu_display.geojson');
const disp = JSON.parse(fs.readFileSync(dispPath, 'utf8'));
const spliced = spliceJejuDisplay(disp, jeju.features);
// 가드: (a) 2시 제거+43동 추가 동치, (b) 절대 296(levelLayerConfig.total과 일치), (c) 2시 코드 부재.
const expDisp = disp.features.length - 2 + jeju.features.length;
const dispCodes = new Set(spliced.features.map((f) => String(f.properties.sgg)));
if (spliced.features.length !== expDisp || spliced.features.length !== 296
  || dispCodes.has('50110') || dispCodes.has('50130')) {
  console.error(`✗ 표시 스플라이스 가드 실패: ${spliced.features.length} (기대 296)`);
  process.exit(1);
}
fs.writeFileSync(dispPath, JSON.stringify(spliced));
console.log(`✓ sigungu_display 제주 세분화: ${disp.features.length} → ${spliced.features.length}`);

// 2) region_codes 에 동 엔트리(level:emd) 추가. 50110/50130(base 매처용)은 유지.
const rcPath = path.join(DEST_DIR, 'region_codes.json');
const rc = JSON.parse(fs.readFileSync(rcPath, 'utf8'));
const merged = mergeJejuRegionCodes(rc, jeju.features);
if (merged.length !== rc.length + 43
  || !merged.some((e) => e.regionCode === '50110')
  || !merged.some((e) => e.regionCode === '50130')) {
  console.error(`✗ region_codes 가드 실패: ${merged.length} (기대 ${rc.length + 43}, 50110/50130 유지)`);
  process.exit(1);
}
fs.writeFileSync(rcPath, JSON.stringify(merged));
console.log(`✓ region_codes 제주 동 추가: ${rc.length} → ${merged.length}`);

// 3) 워커 2차 매처용 제주 동 geojson 배치
fs.writeFileSync(path.join(DEST_DIR, 'jeju-emd.geojson'), JSON.stringify(jeju));
console.log(`✓ jeju-emd.geojson 배치(${jeju.features.length} 동)`);

console.log(`완료: ${copied}/${FILES.length} → ${DEST_DIR}`);
