'use client';

// src/components/trip/TripListScreen.tsx — 경로지도 탭. 여행 목록(최신순) ↔ 경로지도 전환.

import { useState, type CSSProperties } from 'react';
import dynamic from 'next/dynamic';
import type { TripRecord } from '@/data/models';
import { useTripsByRecent, useRegionNames } from '@/hooks/useTrips';
import { TripRow } from '@/components/trip/TripRow';

// maplibre는 경로지도 진입 시에만 로드(지역탭은 100% 오프라인). CSS·라이브러리 모두 이 시점에.
const TripMapView = dynamic(
  () => import('@/components/trip/TripMapView').then((m) => m.TripMapView),
  { ssr: false, loading: () => <div style={center}>지도 불러오는 중…</div> },
);

export function TripListScreen() {
  const trips = useTripsByRecent();
  const names = useRegionNames();
  const [open, setOpen] = useState<TripRecord | null>(null);

  if (open) {
    return <TripMapView trip={open} onBack={() => setOpen(null)} />;
  }

  if (trips === undefined) {
    return <div style={center}>불러오는 중…</div>;
  }
  if (trips.length === 0) {
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
