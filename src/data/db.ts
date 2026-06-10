// src/data/db.ts — Dexie 스키마/컨테이너. Swift BaljachwiSchema 의 DB 경계 대응.
//
// 설계(models 카드 오버라이드 표):
//  - 5 테이블. SwiftData 자동 경량 마이그레이션 이력(V1→V3 가산)은 TS 신규 스키마와 무관 →
//    version(1) 에 전 필드/테이블 포함(BaljachwiSchema 의 "라이브 모델만으로 컨테이너" 와 동치).
//  - 인덱스(override 표 기준):
//      photoRefs:      '&localIdentifier, tripID'   (PK localIdentifier + tripID equals 쿼리)
//      tripRecords:    '&id, startAt'
//      regionStatuses: '&regionCode, level'
//      homeCache:      '&id'                          (단일행, 항상 id=1 upsert)
//      thumbs:         '&localIdentifier'             (썸네일 Blob 보관 — 분리 테이블)
//  - sortIndex 는 인덱스로 두지 않고 읽기 시 (a,b)=>a.sortIndex-b.sortIndex 숫자 정렬
//    (Swift SortDescriptor 와 동치, 안정 정렬로 동률 시 삽입 순서 보존).
//  - 레코드 타입은 models.ts 에서 import(중복 정의 금지).

import Dexie, { type Table } from 'dexie';
import type { PhotoRef, TripRecord, RegionStatus, HomeCache } from '@/data/models';

/** 썸네일 1장. localIdentifier 로 PhotoRef 와 1:1. data 는 Blob(런타임) — 별도 테이블로 분리.
 *  (테스트는 fake-indexeddb 의 structured-clone 제약상 Blob 을 넣지 않는다.) */
export interface Thumb {
  localIdentifier: string;
  data: Blob;
}

/**
 * 발자취 IndexedDB 컨테이너.
 *
 * 테스트는 fake-indexeddb 로 인메모리(Swift inMemoryContainer 대응). name 을 달리해
 * 격리하거나, 단일 DB 를 공유하고 매 테스트 전 table.clear() 로 격리한다(ModelTests 패턴).
 */
export class BaljachwiDB extends Dexie {
  photoRefs!: Table<PhotoRef, string>;
  tripRecords!: Table<TripRecord, string>;
  regionStatuses!: Table<RegionStatus, string>;
  homeCache!: Table<HomeCache, number>;
  thumbs!: Table<Thumb, string>;

  constructor(name = 'baljachwi') {
    super(name);
    this.version(1).stores({
      photoRefs: '&localIdentifier, tripID',
      tripRecords: '&id, startAt',
      regionStatuses: '&regionCode, level',
      homeCache: '&id',
      thumbs: '&localIdentifier',
    });
  }
}
