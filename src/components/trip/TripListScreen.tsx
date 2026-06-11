'use client';

// src/components/trip/TripListScreen.tsx — 여행 목록 탭. 현지 날짜별 일자 카드(최신순) ↔ 그날 핀 지도.
import { useState, type CSSProperties } from 'react';
import dynamic from 'next/dynamic';
import { useDayGroups, useRegionNames } from '@/hooks/useTrips';
import { DayGroupRow } from '@/components/trip/DayGroupRow';
import { dayLabel, type DayGroup } from '@/lib/dayGroups';

// maplibre는 그날 지도 진입 시에만 로드(지역탭은 100% 오프라인 유지).
const PhotoMapView = dynamic(
  () => import('@/components/trip/PhotoMapView').then((m) => m.PhotoMapView),
  { ssr: false, loading: () => <div style={center}>지도 불러오는 중…</div> },
);

export function TripListScreen() {
  const groups = useDayGroups();
  const names = useRegionNames();
  const [open, setOpen] = useState<DayGroup | null>(null);

  if (open) {
    // 핀 클릭 시 같은-날 연결선(현행 Req2). 그날 사진은 이미 같은 localDay라 클릭 시 그날만 연결.
    return (
      <PhotoMapView photos={open.photos} title={dayLabel(open.localDay)} onBack={() => setOpen(null)} />
    );
  }
  if (groups === undefined) return <div style={center}>불러오는 중…</div>;
  if (groups.length === 0) return <div style={center}>아직 여행이 없습니다</div>;

  return (
    <div style={list}>
      {groups.map((g) => (
        <DayGroupRow key={g.localDay} group={g} names={names} onOpen={setOpen} />
      ))}
    </div>
  );
}

const list: CSSProperties = { flex: 1, minHeight: 0, overflowY: 'auto', width: '100%' };
const center: CSSProperties = {
  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--label2)',
};
