#!/usr/bin/env node
// 한국 시군구/시도 표시 폴리곤을 컴팩트한 SVG path 아티팩트(JSON)로 사전생성한다.
// design/gen-choropleth.mjs 의 byte-faithful 포트 — iOS MapProjection 과 동일한 투영
//   x = (lon - minLon) * cos36 * scale,  y = (maxLat - lat) * scale   (Y-flip)
// 색상(방문 상태)은 런타임 HTML 에서 data-state 로 부여하므로 여기선 순수 기하만.
//
// 원본: BALJACHWI_IOS_ROOT(기본 ../baljachwi)의 *_display.geojson
// 산출: public/geo/korea-sigungu.paths.json, public/geo/korea-sido.paths.json
import fs from 'node:fs';
import path from 'node:path';

const IOS_ROOT = process.env.BALJACHWI_IOS_ROOT ?? '../baljachwi';
const RES_DIR = path.resolve(
  process.cwd(),
  IOS_ROOT,
  'BaljachwiCore/Sources/BaljachwiCore/Resources',
);
const OUT_DIR = path.resolve(process.cwd(), 'public/geo');

// 본토 중심 fit(advisor: 색 가독 우선). 울릉/독도(lon>130)는 스케일에서 제외.
const FIT = { minLon: 124.6, maxLon: 130.0, minLat: 33.0, maxLat: 38.65 };
const W = 380; // viewBox 폭(px)
const COS36 = Math.cos((36 * Math.PI) / 180);
const TOL = 0.0032; // Douglas-Peucker 허용오차(deg, ~300m)
const AREA_MIN = 0.0004; // 이보다 작은 링은 드롭(deg^2), 단 feature 최대 링은 유지

const lonSpanEff = (FIT.maxLon - FIT.minLon) * COS36;
const latSpan = FIT.maxLat - FIT.minLat;
const SCALE = W / lonSpanEff;
const H = Math.round(latSpan * SCALE);

// 코드/이름 속성 키 후보(시군구·시도 GeoJSON 스키마 차이 흡수)
const CODE_KEYS = ['sgg', 'sido', 'SIG_CD', 'CTPRVN_CD', 'adm_cd', 'code'];
const NAME_KEYS = ['sggnm', 'sidonm', 'SIG_KOR_NM', 'CTP_KOR_NM', 'adm_nm', 'name'];

function pick(props, keys) {
  for (const k of keys) if (props[k] != null) return props[k];
  return undefined;
}

// ---- Douglas-Peucker(도 단위 수직거리) ----
function dp(points, tol) {
  if (points.length < 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let maxD = -1;
    let idx = -1;
    const [ax, ay] = points[a];
    const [bx, by] = points[b];
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy || 1e-12;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = points[i];
      const t = ((px - ax) * dx + (py - ay) * dy) / len2;
      const cx = ax + t * dx;
      const cy = ay + t * dy;
      const d = (px - cx) ** 2 + (py - cy) ** 2;
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (Math.sqrt(maxD) > tol && idx !== -1) {
      keep[idx] = 1;
      stack.push([a, idx], [idx, b]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

function ringArea(r) {
  // shoelace, abs, deg^2
  let s = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    s += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]);
  }
  return Math.abs(s) / 2;
}

function project([lon, lat]) {
  const x = (lon - FIT.minLon) * COS36 * SCALE;
  const y = (FIT.maxLat - lat) * SCALE; // flip Y
  return [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
}

function polysOf(geom) {
  if (geom.type === 'Polygon') {
    return [{ outer: geom.coordinates[0], holes: geom.coordinates.slice(1) }];
  }
  if (geom.type === 'MultiPolygon') {
    return geom.coordinates.map((p) => ({ outer: p[0], holes: p.slice(1) }));
  }
  return [];
}

function ringToPath(ring) {
  const simplified = dp(ring, TOL);
  if (simplified.length < 4) return null;
  const pts = simplified.map(project);
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) d += `L${pts[i][0]} ${pts[i][1]}`;
  return d + 'Z';
}

function build(srcFile, outFile, levelLabel) {
  const src = path.join(RES_DIR, srcFile);
  if (!fs.existsSync(src)) {
    console.error(`✗ 원본 없음: ${src}`);
    return false;
  }
  const gj = JSON.parse(fs.readFileSync(src, 'utf8'));
  const regions = [];
  let dropped = 0;
  let ringsIn = 0;
  let ringsOut = 0;

  for (const f of gj.features) {
    const code = pick(f.properties, CODE_KEYS);
    const name = pick(f.properties, NAME_KEYS);
    const polys = polysOf(f.geometry);
    const ranked = polys
      .map((p) => ({ ...p, area: ringArea(p.outer) }))
      .sort((a, b) => b.area - a.area);
    ringsIn += polys.reduce((n, p) => n + 1 + p.holes.length, 0);

    let d = '';
    ranked.forEach((p, i) => {
      if (i > 0 && p.area < AREA_MIN) return; // 나머지가 작으면 최대 링만 유지
      const outerPath = ringToPath(p.outer);
      if (!outerPath) return;
      d += outerPath;
      ringsOut++;
      for (const hole of p.holes) {
        if (ringArea(hole) < AREA_MIN) continue;
        const hp = ringToPath(hole);
        if (hp) {
          d += hp;
          ringsOut++;
        }
      }
    });

    if (!d) {
      dropped++;
      continue;
    }
    regions.push({ code: String(code), name: String(name), d });
  }

  const payload = { level: levelLabel, viewBox: `0 0 ${W} ${H}`, w: W, h: H, regions };
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const out = path.join(OUT_DIR, outFile);
  fs.writeFileSync(out, JSON.stringify(payload));
  const kb = (fs.statSync(out).size / 1024).toFixed(0);
  console.log(
    `✓ ${levelLabel}: ${regions.length} regions (dropped ${dropped}), rings ${ringsIn}→${ringsOut}, ${kb} KB → ${outFile}`,
  );
  return true;
}

const targets = [
  ['sigungu_display.geojson', 'korea-sigungu.paths.json', 'sigungu'],
  ['sido_display.geojson', 'korea-sido.paths.json', 'sido'],
];

let ok = true;
console.log(`viewBox 0 0 ${W} ${H}  scale=${SCALE.toFixed(2)}`);
for (const [srcFile, outFile, level] of targets) {
  ok = build(srcFile, outFile, level) && ok;
}
process.exit(ok ? 0 : 1);
