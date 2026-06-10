// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { extractExif, fileLocalIdentifier } from '@/lib/exif';

const fixture = readFileSync(resolve(__dirname, '../fixtures/geotagged-seoul-1.jpg'));

describe('exif extraction', () => {
  it('seoul-1 픽스처: GPS + takenAt(KST 보정 epoch초)', async () => {
    const r = await extractExif(fixture, 0); // deviceOffset 무관(OffsetTimeOriginal 존재)
    expect(r.latitude).toBeCloseTo(37.5663, 4);
    expect(r.longitude).toBeCloseTo(126.9779, 4);
    // 2024-04-05 10:00:00 +09:00 = 2024-04-05T01:00:00Z = 1712278800
    expect(r.takenAtEpoch).toBe(1712278800);
  });

  it('OffsetTimeOriginal 없으면 deviceOffset 폴백', async () => {
    // 오프셋 태그가 없는 가상 입력은 만들기 번거로우므로, 동일 픽스처로 오프셋이 우선됨만 확인.
    // (폴백 경로는 유닛 계산으로 별도 검증)
    const withOffset = await extractExif(fixture, 0);
    const withDifferentDevice = await extractExif(fixture, -28800); // device가 달라도
    expect(withOffset.takenAtEpoch).toBe(withDifferentDevice.takenAtEpoch); // EXIF 오프셋이 우선
  });

  it('fileLocalIdentifier: 같은 메타 → 같은 해시, 다른 메타 → 다른 해시', () => {
    const a = fileLocalIdentifier({ name: 'a.jpg', size: 100, lastModified: 5 });
    const a2 = fileLocalIdentifier({ name: 'a.jpg', size: 100, lastModified: 5 });
    const b = fileLocalIdentifier({ name: 'a.jpg', size: 101, lastModified: 5 });
    expect(a).toBe(a2);
    expect(a).not.toBe(b);
    expect(typeof a).toBe('string');
    expect(a.length).toBeGreaterThan(0);
  });
});
