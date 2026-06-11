'use client';

// src/components/trip/TripListScreen.tsx — 여행 목록 탭. 여행 목록(최신순) ↔ 그 여행 핀 지도 전환.

import { useState, type CSSProperties } from 'react';
import dynamic from 'next/dynamic';
import type { TripRecord } from '@/data/models';
import { useTripsByRecent, useRegionNames, useAllPhotos } from '@/hooks/useTrips';
import { TripRow } from '@/components/trip/TripRow';

// maplibre는 여행 핀 지도 진입 시에만 로드(지역탭은 100% 오프라인). CSS·라이브러리 모두 이 시점에.
const TripMapView = dynamic(
  () => import('@/components/trip/TripMapView').then((m) => m.TripMapView),
  { ssr: false, loading: () => <div style={center}>지도 불러오는 중…</div> },
);

export function TripListScreen() {
  const trips = useTripsByRecent();
  const names = useRegionNames();
  const allPhotos = useAllPhotos();
  const [open, setOpen] = useState<TripRecord | null>(null);

  if (open) {
    return <TripMapView trip={open} onBack={() => setOpen(null)} />;
  }

  if (trips === undefined) {
    return <div style={center}>불러오는 중…</div>;
  }
  if (trips.length === 0) {
    if (allPhotos === undefined) return <div style={center}>불러오는 중…</div>;
    // 경로지도 탭이 전체-핀 지도를 담당하므로, 여행목록은 지도를 중복 표시하지 않고 안내만 한다.
    // (여행 분할 trivial/home 억제로 사진은 있어도 여행 0개일 수 있음.)
    if (allPhotos.length > 0) {
      return (
        <div style={center}>
          <div style={hintWrap}>
            아직 여행으로 묶인 사진이 없어요
            <div style={hint}>전체 사진은 ‘경로지도’ 탭에서 볼 수 있어요</div>
          </div>
        </div>
      );
    }
    return <div style={center}>아직 여행이 없습니다</div>;
  }

  return (
    <div style={list}>
      {trips.map((t) => (
        <TripRow key={t.id} trip={t} names={names} onOpen={setOpen} />
      ))}
    </div>
  );
}

const list: CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflowY: 'auto',
  width: '100%',
};
const center: CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--label2)',
};
const hintWrap: CSSProperties = { textAlign: 'center', padding: 'var(--space-4)' };
const hint: CSSProperties = { marginTop: 'var(--space-2)', fontSize: 13, color: 'var(--label2)' };
