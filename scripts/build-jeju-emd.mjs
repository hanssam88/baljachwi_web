// scripts/build-jeju-emd.mjs — vuski 행정동(2026)에서 제주만 추려 정규화 asset 생성.
// 출처: github.com/vuski/admdongkor ver20260201 (통계청 SGIS 기반, KOGL 출처표시).
// 재현: node scripts/build-jeju-emd.mjs  (네트워크 필요; 산출물은 커밋되어 평소엔 재실행 불필요)
import fs from 'node:fs';
import https from 'node:https';

const URL = 'https://raw.githubusercontent.com/vuski/admdongkor/master/ver20260201/HangJeongDong_ver20260201.geojson';
const OUT = 'assets/geo/jeju-emd.geojson';

function get(url, cb, depth = 0) {
  if (depth > 5) return cb(new Error('redirects'));
  https.get(url, { headers: { 'User-Agent': 'node' } }, (res) => {
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
      res.resume(); return get(res.headers.location, cb, depth + 1);
    }
    if (res.statusCode !== 200) { res.resume(); return cb(new Error('HTTP ' + res.statusCode)); }
    const ch = []; res.on('data', (c) => ch.push(c)); res.on('end', () => cb(null, Buffer.concat(ch)));
  }).on('error', cb);
}

// vuski 속성명은 버전마다 다를 수 있어 후보 중 존재하는 키를 사용(불일치 시 진단 출력).
function pick(props, candidates) {
  for (const k of candidates) if (props[k] != null) return props[k];
  return undefined;
}

get(URL, (err, buf) => {
  if (err) { console.error('✗ fetch:', err.message); process.exit(1); }
  const g = JSON.parse(buf.toString('utf8'));
  const sample = g.features[0]?.properties ?? {};
  const sggOf = (p) => String(pick(p, ['sgg', 'SGG', 'sigungu']) ?? '');
  const cd2Of = (p) => String(pick(p, ['adm_cd2', 'ADM_CD2', 'adm_cd', 'ADM_CD']) ?? '');
  const nmOf = (p) => String(pick(p, ['adm_nm', 'ADM_NM', 'temp']) ?? '');

  const features = g.features
    .filter((f) => sggOf(f.properties).startsWith('50'))
    .map((f) => ({
      type: 'Feature',
      properties: {
        sgg: cd2Of(f.properties),                          // 동 코드(promoteId, 10자리)
        sggnm: nmOf(f.properties).split(' ').slice(-1)[0],  // 맨 토큰 = 동/읍/면명(충돌 0 검증됨)
        sido: '50',
        sidonm: '제주특별자치도',
        parentSgg: sggOf(f.properties),                     // 50110/50130 (추적용)
      },
      geometry: f.geometry,
    }));

  if (features.length !== 43) {
    console.error('✗ 기대 43, 실제', features.length);
    console.error('  전체 피처:', g.features.length, '| 첫 피처 속성 키:', Object.keys(sample));
    console.error('  샘플 속성:', JSON.stringify(sample).slice(0, 300));
    process.exit(1);
  }
  fs.mkdirSync('assets/geo', { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({ type: 'FeatureCollection', features }));
  console.log(`✓ ${OUT} (${features.length} features, ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB)`);
});
