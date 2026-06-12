'use client';

// src/components/trip/TripListScreen.tsx — 여행 목록 탭. 일자 카드(최신순) ↔ 그날 핀 지도 ↔ 사진 다중삭제.
import { useState, type CSSProperties } from 'react';
import dynamic from 'next/dynamic';
import { useDayGroups, useRegionNames } from '@/hooks/useTrips';
import { DayGroupRow } from '@/components/trip/DayGroupRow';
import { PhotoSelectScreen } from '@/components/trip/PhotoSelectScreen';
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
  const [manage, setManage] = useState<DayGroup | null>(null);

  if (open) {
    // open.photos는 스냅샷(라이브 아님) → 핀 삭제 후 onAfterDelete로 닫아 라이브 목록 복귀.
    return (
      <PhotoMapView
        photos={open.photos}
        title={dayLabel(open.localDay)}
        onBack={() => setOpen(null)}
        onAfterDelete={() => setOpen(null)}
      />
    );
  }
  if (manage) {
    return (
      <PhotoSelectScreen
        title={dayLabel(manage.localDay)}
        photos={manage.photos}
        onBack={() => setManage(null)}
        onDeleted={() => setManage(null)}
      />
    );
  }
  if (groups === undefined) return <div style={center}>불러오는 중…</div>;
  if (groups.length === 0) return <div style={center}>아직 여행이 없습니다</div>;

  return (
    <div style={list}>
      {groups.map((g) => (
        <DayGroupRow key={g.localDay} group={g} names={names} onOpen={setOpen} onManage={setManage} />
      ))}
    </div>
  );
}

// overflowX 'hidden' 명시: overflowY 'auto'만 두면 명세상 overflowX가 visible→auto로 승격되어
// 가로 rubber-band 흔들림이 생긴다. 세로만 스크롤, 가로 고정.
const list: CSSProperties = { flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', width: '100%' };
const center: CSSProperties = {
  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--label2)',
};
