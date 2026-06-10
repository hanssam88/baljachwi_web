// src/data/queries.ts — liveQuery 구독(읽기 전용). SwiftData @Query 대응.
//
// Dexie liveQuery 는 IndexedDB 변경 시 자동 재발화 → React 는 useLive(아래) 로 구독.
// 모든 쿼리는 getDB() 싱글턴 기준. 쓰기는 절대 하지 않는다(repo.ts 전담).

import { liveQuery, type Observable } from 'dexie';
import { getDB } from '@/data/db';
import type { PhotoRef, TripRecord, RegionStatus } from '@/data/models';

/** 전 지역 상태(지역지도 색칠 소스). */
export function regionStatuses$(): Observable<RegionStatus[]> {
  return liveQuery(() => getDB().regionStatuses.toArray());
}

/** 여행 목록(최신순 = startAt 내림차순). */
export function trips$(): Observable<TripRecord[]> {
  return liveQuery(() => getDB().tripRecords.orderBy('startAt').reverse().toArray());
}

/** 특정 여행의 사진(sortIndex 오름차순). */
export function photosForTrip$(tripID: string): Observable<PhotoRef[]> {
  return liveQuery(() => getDB().photoRefs.where('tripID').equals(tripID).sortBy('sortIndex'));
}

/** 전체 사진 수(빈/채움 분기용). */
export function photoCount$(): Observable<number> {
  return liveQuery(() => getDB().photoRefs.count());
}
