// tests/data/jejuEmd.test.ts
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const fc = JSON.parse(fs.readFileSync(path.resolve('assets/geo/jeju-emd.geojson'), 'utf8'));

describe('jeju-emd asset', () => {
  it('43 features', () => expect(fc.features.length).toBe(43));
  it('제주시 26 + 서귀포시 17', () => {
    const byGu = (s: string) => fc.features.filter((f: any) => f.properties.parentSgg === s).length;
    expect(byGu('50110')).toBe(26);
    expect(byGu('50130')).toBe(17);
  });
  it('props 정규화 + 코드 10자리 유니크 + 동명 유일', () => {
    const codes = new Set<string>();
    const names = new Set<string>();
    for (const f of fc.features) {
      const p = f.properties;
      expect(p.sido).toBe('50');
      expect(p.sidonm).toBe('제주특별자치도');
      expect(typeof p.sggnm).toBe('string');
      expect(p.sggnm.length).toBeGreaterThan(0);
      expect(String(p.sgg)).toHaveLength(10);
      expect(['Polygon', 'MultiPolygon']).toContain(f.geometry.type);
      codes.add(p.sgg);
      names.add(p.sggnm);
    }
    expect(codes.size).toBe(43);
    // 동명 충돌 0 검증(이름은 "제주 {sggnm}"로 표시되므로 표시 라벨 모호성 방지).
    expect(names.size).toBe(43);
  });
});
