'use client';

// src/hooks/useTrips.ts — 여행 목록(최신순) + regionCode→표시명 맵(RegionNames).

import { useEffect, useState } from 'react';
import { useLive } from '@/hooks/useLive';
import { getDB } from '@/data/db';
import { RegionNames } from '@/core/regionNames';
import type { RegionCodeEntry } from '@/core/geoDataStore';
import type { TripRecord, PhotoRef } from '@/data/models';

/** 여행 목록(startAt 내림차순). 미마운트/로딩 중이면 undefined. */
export function useTripsByRecent(): TripRecord[] | undefined {
  return useLive(() => getDB().tripRecords.orderBy('startAt').reverse().toArray(), []);
}

/** 여행 사진(sortIndex 오름차순). */
export function usePhotosForTrip(tripID: string): PhotoRef[] | undefined {
  return useLive(() => getDB().photoRefs.where('tripID').equals(tripID).sortBy('sortIndex'), [tripID]);
}

/** region_codes.json → regionCode→표시명 맵(1회 fetch). */
export function useRegionNames(): Record<string, string> {
  const [names, setNames] = useState<Record<string, string>>({});
  useEffect(() => {
    let alive = true;
    fetch('/geo/region_codes.json')
      .then((r) => r.json())
      .then((entries: RegionCodeEntry[]) => {
        if (!alive) return;
        const rn = new RegionNames(entries);
        setNames(Object.fromEntries(rn.names));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return names;
}
