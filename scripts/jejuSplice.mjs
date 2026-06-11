// scripts/jejuSplice.mjs — 제주 동 스플라이스 순수 helper(copy-geo가 호출, 부작용 없음).
const JEJU_SGG = new Set(['50110', '50130']);
const DISPLAY_KEYS = ['sgg', 'sggnm', 'sido', 'sidonm'];

function bboxOf(geom) {
  let a = [Infinity, Infinity, -Infinity, -Infinity];
  const walk = (c) => {
    if (typeof c[0] === 'number') {
      a[0] = Math.min(a[0], c[0]); a[1] = Math.min(a[1], c[1]);
      a[2] = Math.max(a[2], c[0]); a[3] = Math.max(a[3], c[1]);
    } else c.forEach(walk);
  };
  walk(geom.coordinates);
  return a.map((x) => Math.round(x * 1e6) / 1e6);
}

/** 표시 FeatureCollection: 제주 2시 제거 + 43동 추가(표시 props 4키만). */
export function spliceJejuDisplay(fc, jejuFeatures) {
  const kept = fc.features.filter((f) => !JEJU_SGG.has(String(f.properties.sgg)));
  const dongs = jejuFeatures.map((f) => ({
    type: 'Feature',
    properties: Object.fromEntries(DISPLAY_KEYS.map((k) => [k, f.properties[k]])),
    geometry: f.geometry,
  }));
  return { type: 'FeatureCollection', features: [...kept, ...dongs] };
}

/** region_codes: 50110/50130 유지(base 매처용) + 43동 level:'emd' 추가(이름/분모 무영향 분리). */
export function mergeJejuRegionCodes(entries, jejuFeatures) {
  const emd = jejuFeatures.map((f) => ({
    regionCode: String(f.properties.sgg),
    level: 'emd',
    nameKo: `제주 ${f.properties.sggnm}`, // regionNames else분기 → 그대로 표시
    sidoCode: '50',
    bbox: bboxOf(f.geometry),
  }));
  return [...entries, ...emd];
}
