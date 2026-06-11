// tests/scripts/jejuSplice.test.ts
import { describe, it, expect } from 'vitest';
import { spliceJejuDisplay, mergeJejuRegionCodes } from '../../scripts/jejuSplice.mjs';

const jeju = [
  { type: 'Feature', properties: { sgg: '5011025000', sggnm: '한림읍', sido: '50', sidonm: '제주특별자치도', parentSgg: '50110' }, geometry: { type: 'Polygon', coordinates: [[[126, 33], [126.1, 33], [126.1, 33.1], [126, 33]]] } },
];

describe('spliceJejuDisplay', () => {
  it('50110/50130 제거 후 제주 동 추가', () => {
    const fc = {
      type: 'FeatureCollection', features: [
        { properties: { sgg: '11110', sggnm: '종로구', sido: '11', sidonm: '서울특별시' } },
        { properties: { sgg: '50110', sggnm: '제주시', sido: '50', sidonm: '제주특별자치도' } },
        { properties: { sgg: '50130', sggnm: '서귀포시', sido: '50', sidonm: '제주특별자치도' } },
      ]
    };
    const out = spliceJejuDisplay(fc, jeju);
    const codes = out.features.map((f: any) => f.properties.sgg);
    expect(codes).not.toContain('50110');
    expect(codes).not.toContain('50130');
    expect(codes).toContain('11110');
    expect(codes).toContain('5011025000');
    expect(out.features.length).toBe(2); // 종로 + 한림읍
    // 표시 props는 4개 키만(parentSgg 제거) — 집합 비교로 누락/추가 키 모두 차단
    const f = out.features.find((x: any) => x.properties.sgg === '5011025000');
    expect(new Set(Object.keys(f.properties))).toEqual(new Set(['sgg', 'sggnm', 'sido', 'sidonm']));
  });
});

describe('mergeJejuRegionCodes', () => {
  it('동 엔트리를 level:emd 로 추가, nameKo는 "제주 동명"', () => {
    const entries = [{ regionCode: '50110', level: 'sigungu', nameKo: '제주시', sidoCode: '50', bbox: [0, 0, 0, 0] }];
    const out = mergeJejuRegionCodes(entries, jeju);
    const emd = out.find((e: any) => e.regionCode === '5011025000');
    expect(emd.level).toBe('emd');
    expect(emd.nameKo).toBe('제주 한림읍');
    expect(emd.sidoCode).toBe('50');
    expect(emd.bbox).toHaveLength(4);
    // 추가된 emd 엔트리 전부 4-length bbox (GeoDataStore가 모든 엔트리에 bbox 요구).
    const added = out.filter((e: any) => e.level === 'emd');
    expect(added.every((e: any) => Array.isArray(e.bbox) && e.bbox.length === 4)).toBe(true);
    // 기존 50110(코어 base 매처용)은 유지
    expect(out.some((e: any) => e.regionCode === '50110')).toBe(true);
  });
});
