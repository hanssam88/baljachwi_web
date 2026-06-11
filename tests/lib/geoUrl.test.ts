import { describe, it, expect, afterEach } from 'vitest';
import { geoUrl } from '@/lib/geoUrl';

const orig = process.env.NEXT_PUBLIC_BASE_PATH;
afterEach(() => {
  process.env.NEXT_PUBLIC_BASE_PATH = orig;
});

describe('geoUrl', () => {
  it('env 없으면 경로 그대로 (로컬 dev / root 호스팅)', () => {
    delete process.env.NEXT_PUBLIC_BASE_PATH;
    expect(geoUrl('/geo/sigungu.geojson')).toBe('/geo/sigungu.geojson');
  });
  it('basePath 있으면 prefix (Pages 하위경로)', () => {
    process.env.NEXT_PUBLIC_BASE_PATH = '/baljachwi_web';
    expect(geoUrl('/geo/jeju-emd.geojson')).toBe('/baljachwi_web/geo/jeju-emd.geojson');
  });
  it('빈 문자열 env는 prefix 없음', () => {
    process.env.NEXT_PUBLIC_BASE_PATH = '';
    expect(geoUrl('/geo/region_codes.json')).toBe('/geo/region_codes.json');
  });
  it('끝 슬래시가 있어도 더블슬래시 없이 정규화 (리뷰 반영)', () => {
    process.env.NEXT_PUBLIC_BASE_PATH = '/baljachwi_web/';
    expect(geoUrl('/geo/sigungu.geojson')).toBe('/baljachwi_web/geo/sigungu.geojson');
  });
});
