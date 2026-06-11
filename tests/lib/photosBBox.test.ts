import { describe, it, expect } from 'vitest';
import { photosBBox } from '@/lib/photosBBox';

describe('photosBBox', () => {
  it('빈 배열이면 null', () => {
    expect(photosBBox([])).toBeNull();
  });
  it('1장이면 그 좌표가 min==max', () => {
    expect(photosBBox([{ lat: 33.5, lon: 126.5 }])).toEqual({
      minLat: 33.5, minLon: 126.5, maxLat: 33.5, maxLon: 126.5,
    });
  });
  it('여러 장이면 경계 박스', () => {
    expect(
      photosBBox([
        { lat: 33.5, lon: 126.5 },
        { lat: 37.5, lon: 127.0 },
        { lat: 35.0, lon: 126.0 },
      ]),
    ).toEqual({ minLat: 33.5, minLon: 126.0, maxLat: 37.5, maxLon: 127.0 });
  });
});
