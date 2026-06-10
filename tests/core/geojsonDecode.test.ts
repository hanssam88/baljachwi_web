import { describe, it, expect } from 'vitest';
import {
  polygonsFromGeoJSON,
  polygonsBySgg,
  type GeoJSONFeatureCollection,
} from '@/core/geojsonDecode';

// ── 헬퍼 픽스처 빌더 ───────────────────────────────────────────────
// GeoJSON pair는 [lon, lat] 순서. Coordinate는 {lat: pair[1], lon: pair[0]}.

const SEOUL_POLYGON_FC = {
  features: [
    {
      properties: { sgg: '11110' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [126.97, 37.57],
            [126.99, 37.57],
            [126.99, 37.6],
            [126.97, 37.57],
          ],
        ],
      },
    },
  ],
};

describe('geojsonDecode — polygonNormalizedToMultiPolygon', () => {
  it('Polygon → MultiPolygon(1개), lon/lat 스왑 검증', () => {
    const map = polygonsFromGeoJSON(SEOUL_POLYGON_FC, 'sgg');
    expect(map.size).toBe(1);
    const mp = map.get('11110')!;
    expect(mp.polygons).toHaveLength(1);
    const outer = mp.polygons[0].outer;
    expect(outer).toHaveLength(4);
    // [126.97, 37.57] → {lat: 37.57, lon: 126.97} (스왑 핵심 검증)
    expect(outer[0]).toEqual({ lat: 37.57, lon: 126.97 });
    expect(mp.polygons[0].holes).toEqual([]);
  });
});

describe('geojsonDecode — multiPolygonPreservesOrderAndCount', () => {
  it('MultiPolygon 폴리곤 2개의 입력 순서·개수 보존', () => {
    const fc = {
      features: [
        {
          properties: { sgg: '46910' },
          geometry: {
            type: 'MultiPolygon',
            coordinates: [
              // 폴리곤 A — 첫 점 [126.5, 37.0]
              [
                [
                  [126.5, 37.0],
                  [126.6, 37.0],
                  [126.6, 37.1],
                  [126.5, 37.0],
                ],
              ],
              // 폴리곤 B — 첫 점 [129.0, 35.1]
              [
                [
                  [129.0, 35.1],
                  [129.1, 35.1],
                  [129.1, 35.2],
                  [129.0, 35.1],
                ],
              ],
            ],
          },
        },
      ],
    };
    const map = polygonsFromGeoJSON(fc, 'sgg');
    const mp = map.get('46910')!;
    expect(mp.polygons).toHaveLength(2);
    expect(mp.polygons[0].outer[0].lon).toBe(126.5);
    expect(mp.polygons[0].outer[0].lat).toBe(37.0);
    expect(mp.polygons[1].outer[0].lon).toBe(129.0);
    expect(mp.polygons[1].outer[0].lat).toBe(35.1);
  });
});

describe('geojsonDecode — firstRingIsOuterRestAreHoles', () => {
  it('첫 ring=outer, 나머지 ring=holes', () => {
    const ring0 = [
      [126.0, 37.0],
      [126.5, 37.0],
      [126.5, 37.5],
      [126.0, 37.0],
    ];
    const ring1 = [
      [126.1, 37.1],
      [126.2, 37.1],
      [126.2, 37.2],
      [126.1, 37.1],
    ];
    const ring2 = [
      [126.3, 37.3],
      [126.4, 37.3],
      [126.4, 37.4],
      [126.3, 37.3],
    ];
    const fc = {
      features: [
        {
          properties: { sgg: '11110' },
          geometry: { type: 'Polygon', coordinates: [ring0, ring1, ring2] },
        },
      ],
    };
    const map = polygonsFromGeoJSON(fc, 'sgg');
    const poly = map.get('11110')!.polygons[0];
    // outer === ring0 스왑매핑
    expect(poly.outer[0]).toEqual({ lat: 37.0, lon: 126.0 });
    expect(poly.outer).toHaveLength(4);
    // holes 2개
    expect(poly.holes).toHaveLength(2);
    expect(poly.holes[0][0]).toEqual({ lat: ring1[0][1], lon: ring1[0][0] });
    expect(poly.holes[1][0]).toEqual({ lat: ring2[0][1], lon: ring2[0][0] });
  });
});

describe('geojsonDecode — featureWithoutCodeKeySkipped', () => {
  it("codeKey='sgg'인데 sido만 있는 feature → 스킵", () => {
    const fc = {
      features: [
        {
          properties: { sido: '11' },
          geometry: { type: 'Polygon', coordinates: [] },
        },
      ],
    };
    const map = polygonsFromGeoJSON(fc, 'sgg');
    expect(map.size).toBe(0);
  });
});

describe('geojsonDecode — sidoCodeKeyDecodesSidoGeojson', () => {
  it("codeKey='sido'면 sido 키로 디코드, 'sgg'면 누락", () => {
    const fc = {
      features: [
        {
          properties: { sido: '11' },
          geometry: { type: 'Polygon', coordinates: [] },
        },
      ],
    };
    const sidoMap = polygonsFromGeoJSON(fc, 'sido');
    expect(sidoMap.has('11')).toBe(true);
    const sggMap = polygonsFromGeoJSON(fc, 'sgg');
    expect(sggMap.has('11')).toBe(false);
    expect(sggMap.size).toBe(0);
  });
});

describe('geojsonDecode — unknownGeometryTypeYieldsEmptyMultiPolygonNotSkipped', () => {
  it('알 수 없는 geometry type → 키는 들어가고 polygons=[] (스킵 아님)', () => {
    const fc = {
      features: [
        {
          properties: { sgg: '99999' },
          geometry: { type: 'Point', coordinates: [127.0, 37.5] },
        },
      ],
    };
    const map = polygonsFromGeoJSON(fc, 'sgg');
    expect(map.has('99999')).toBe(true);
    expect(map.get('99999')!.polygons).toHaveLength(0);
  });
});

describe('geojsonDecode — duplicateCodeLastWins', () => {
  it('동일 code feature 2개 → 마지막 승', () => {
    const fc = {
      features: [
        {
          properties: { sgg: '11110' },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [126.0, 37.0],
                [126.1, 37.0],
                [126.1, 37.1],
                [126.0, 37.0],
              ],
            ],
          },
        },
        {
          properties: { sgg: '11110' },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [126.0, 37.0],
                [126.1, 37.0],
                [126.1, 37.1],
                [126.2, 37.1],
                [126.0, 37.0],
              ],
            ],
          },
        },
      ],
    };
    const map = polygonsFromGeoJSON(fc, 'sgg');
    expect(map.size).toBe(1);
    // 마지막 feature(outer 5점)가 승
    expect(map.get('11110')!.polygons[0].outer).toHaveLength(5);
  });
});

describe('geojsonDecode — polygonsBySggEqualsPolygonsWithSggKey', () => {
  it("polygonsBySgg(json) === polygonsFromGeoJSON(json,'sgg') deep-equal", () => {
    const viaWrapper = polygonsBySgg(SEOUL_POLYGON_FC);
    const viaExplicit = polygonsFromGeoJSON(SEOUL_POLYGON_FC, 'sgg');
    expect(viaWrapper).toEqual(viaExplicit);
  });

  it('polygonsBySgg 기본 동작 — 키·좌표 보존', () => {
    const map = polygonsBySgg(SEOUL_POLYGON_FC);
    expect(map.get('11110')!.polygons[0].outer[0]).toEqual({
      lat: 37.57,
      lon: 126.97,
    });
  });
});

describe('geojsonDecode — emptyRingsPolygonYieldsEmptyOuter', () => {
  it('coordinates=[] Polygon → polygons 1개, outer 빈배열, holes 빈배열', () => {
    const fc = {
      features: [
        {
          properties: { sgg: '11110' },
          geometry: { type: 'Polygon', coordinates: [] },
        },
      ],
    };
    const map = polygonsFromGeoJSON(fc, 'sgg');
    const mp = map.get('11110')!;
    expect(mp.polygons).toHaveLength(1);
    expect(mp.polygons[0].outer).toHaveLength(0);
    expect(mp.polygons[0].holes).toHaveLength(0);
  });
});

describe('geojsonDecode — emptyFeatureCollection', () => {
  it('{features:[]} → map.size===0', () => {
    const map = polygonsFromGeoJSON({ features: [] }, 'sgg');
    expect(map.size).toBe(0);
  });
});

describe('geojsonDecode — malformedShapeThrows', () => {
  it('(1) features 누락 → throw', () => {
    expect(() => polygonsFromGeoJSON({}, 'sgg')).toThrow();
  });

  it('(2) feature 원소에 geometry 누락 → throw', () => {
    const fc = { features: [{ properties: { sgg: '11110' } }] };
    expect(() => polygonsFromGeoJSON(fc, 'sgg')).toThrow();
  });

  it("(3) type:'Polygon'인데 coordinates가 문자열 → throw", () => {
    const fc = {
      features: [
        {
          properties: { sgg: '11110' },
          geometry: { type: 'Polygon', coordinates: 'oops' },
        },
      ],
    };
    expect(() => polygonsFromGeoJSON(fc, 'sgg')).toThrow();
  });

  it('(4) geometry.type 누락 → throw', () => {
    const fc = {
      features: [
        {
          properties: { sgg: '11110' },
          geometry: { coordinates: [] },
        },
      ],
    };
    expect(() => polygonsFromGeoJSON(fc, 'sgg')).toThrow();
  });

  it('추가: 최상위가 객체 아님(null) → throw', () => {
    expect(() => polygonsFromGeoJSON(null, 'sgg')).toThrow();
  });

  it('추가: properties 누락 → throw', () => {
    const fc = {
      features: [{ geometry: { type: 'Polygon', coordinates: [] } }],
    };
    expect(() => polygonsFromGeoJSON(fc, 'sgg')).toThrow();
  });

  it('추가: geometry.type 비문자열(숫자) → throw', () => {
    const fc = {
      features: [
        {
          properties: { sgg: '11110' },
          geometry: { type: 123, coordinates: [] },
        },
      ],
    };
    expect(() => polygonsFromGeoJSON(fc, 'sgg')).toThrow();
  });

  it("추가: Polygon coordinates 중첩 깊이 부족(2겹) → throw", () => {
    const fc = {
      features: [
        {
          properties: { sgg: '11110' },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [126.0, 37.0],
              [126.1, 37.1],
            ],
          },
        },
      ],
    };
    expect(() => polygonsFromGeoJSON(fc, 'sgg')).toThrow();
  });

  it("추가: MultiPolygon coordinates 중첩 깊이 부족(3겹) → throw", () => {
    const fc = {
      features: [
        {
          properties: { sgg: '11110' },
          geometry: {
            type: 'MultiPolygon',
            coordinates: [
              [
                [126.0, 37.0],
                [126.1, 37.1],
              ],
            ],
          },
        },
      ],
    };
    expect(() => polygonsFromGeoJSON(fc, 'sgg')).toThrow();
  });

  it('추가: 좌표 pair 원소 <2 → throw (조용한 NaN 전파 금지)', () => {
    const fc = {
      features: [
        {
          properties: { sgg: '11110' },
          geometry: { type: 'Polygon', coordinates: [[[126.0]]] },
        },
      ],
    };
    expect(() => polygonsFromGeoJSON(fc, 'sgg')).toThrow();
  });

  it('추가: 좌표 pair 원소가 비-number → throw', () => {
    const fc = {
      features: [
        {
          properties: { sgg: '11110' },
          geometry: { type: 'Polygon', coordinates: [[['126.0', '37.0']]] },
        },
      ],
    };
    expect(() => polygonsFromGeoJSON(fc, 'sgg')).toThrow();
  });
});

describe('geojsonDecode — nullCodeTreatedAsAbsent', () => {
  it('properties:{sgg:null} → feature 스킵, map.size===0', () => {
    const fc = {
      features: [
        {
          properties: { sgg: null },
          geometry: { type: 'Polygon', coordinates: [] },
        },
      ],
    };
    const map = polygonsFromGeoJSON(fc, 'sgg');
    expect(map.size).toBe(0);
  });

  it('properties 키 자체 누락(undefined)도 동일하게 스킵', () => {
    const fc = {
      features: [
        {
          properties: {},
          geometry: { type: 'Polygon', coordinates: [] },
        },
      ],
    };
    const map = polygonsFromGeoJSON(fc, 'sgg');
    expect(map.size).toBe(0);
  });
});

describe('geojsonDecode — 기본 인자 codeKey', () => {
  it("codeKey 미지정 시 'sgg' 기본값", () => {
    const map = polygonsFromGeoJSON(SEOUL_POLYGON_FC);
    expect(map.has('11110')).toBe(true);
  });
});

describe('geojsonDecode — 픽스처 타이핑 (export interface 스모크)', () => {
  it('GeoJSONFeatureCollection 타입으로 픽스처 타이핑 가능', () => {
    const fc: GeoJSONFeatureCollection = {
      features: [
        {
          properties: { sgg: '11110' },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [126.97, 37.57],
                [126.99, 37.57],
                [126.99, 37.6],
              ],
            ],
          },
        },
      ],
    };
    const map = polygonsFromGeoJSON(fc as unknown, 'sgg');
    expect(map.size).toBe(1);
  });
});
