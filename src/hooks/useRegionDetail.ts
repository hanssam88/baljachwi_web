'use client';
// src/hooks/useRegionDetail.ts — 선택 지역의 RegionStatus 행 + 지역 필터 사진(라이브).
import { useMemo } from 'react';
import { useLive } from '@/hooks/useLive';
import { getDB } from '@/data/db';
import { useAllPhotos } from '@/hooks/useTrips';
import { photosInRegion } from '@/lib/regionDetail';
import type { RegionStatus, PhotoRef } from '@/data/models';

/** 시군구 RegionStatus 단건(없으면 null=미방문). code=null이면 조회 스킵. PK=regionCode 단건 get. */
export function useRegionStatusRow(code: string | null): RegionStatus | null {
  const row = useLive(
    () => (code === null ? Promise.resolve(undefined) : getDB().regionStatuses.get(code)),
    [code],
  );
  return row ?? null;
}

/** 선택 지역 사진(촬영순). code=null이면 빈 배열. 전체 사진 라이브 + JS 필터(regionCode 인덱스 없음). */
export function usePhotosForRegion(code: string | null): PhotoRef[] {
  const photos = useAllPhotos();
  return useMemo(() => photosInRegion(photos ?? [], code), [photos, code]);
}
