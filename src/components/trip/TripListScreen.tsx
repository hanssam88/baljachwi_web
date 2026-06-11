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

// 빈 상태(여행 0개) 마커맵도 동일하게 지연 로드.
const PhotoMapView = dynamic(
  () => import('@/components/trip/PhotoMapView').then((m) => m.PhotoMapView),
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
    // 여행 0개라도 위치 있는 사진(여행 분할 trivial 제외)이 1장이라도 있으면 마커맵.
    if (allPhotos === undefined) return <div style={center}>불러오는 중…</div>;
    if (allPhotos.length > 0) return <PhotoMapView photos={allPhotos} />;
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
