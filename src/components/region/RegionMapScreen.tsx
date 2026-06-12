'use client';

// src/components/region/RegionMapScreen.tsx — 지역지도 탭.
// MapLibre 지역지도 + 정복률 헤더 + 레벨 토글 + 범례 + 지역 클릭 상세 시트(가고싶음/사진 보기).

import { useState, type CSSProperties } from 'react';
import dynamic from 'next/dynamic';
import { StatHeader } from '@/components/region/StatHeader';
import { LevelToggle, type Level } from '@/components/region/LevelToggle';
import { Legend } from '@/components/region/Legend';
import { RegionDetailSheet } from '@/components/region/RegionDetailSheet';
import { useRegionStatuses } from '@/hooks/useRegionStatuses';
import { useRegionStatusRow, usePhotosForRegion } from '@/hooks/useRegionDetail';
import { useRegionNames } from '@/hooks/useTrips';
import { repo } from '@/data/repo';
import { levelLayerConfig } from '@/lib/regionLayerStyle';
import type { VisitState } from '@/core/visitState';

const RegionMapView = dynamic(
  () => import('@/components/region/RegionMapView').then((m) => m.RegionMapView),
  { ssr: false, loading: () => <div style={loading}>지도 불러오는 중…</div> },
);
const PhotoMapView = dynamic(
  () => import('@/components/trip/PhotoMapView').then((m) => m.PhotoMapView),
  { ssr: false, loading: () => <div style={loading}>지도 불러오는 중…</div> },
);

export function RegionMapScreen() {
  const [level, setLevel] = useState<Level>('sigungu');
  const [selected, setSelected] = useState<string | null>(null); // 상세 시트 대상(시군구 코드)
  const [viewing, setViewing] = useState<string | null>(null);   // "사진 보기" 대상(시군구 코드)
  const { sigungu, sido } = useRegionStatuses();
  const names = useRegionNames();
  const row = useRegionStatusRow(selected);
  const regionPhotos = usePhotosForRegion(viewing);

  const stateByCode = level === 'sigungu' ? sigungu : sido;
  const visitedCount = Object.values(stateByCode).filter((s) => s === 'visited').length;
  const total = levelLayerConfig(level).total;

  const changeLevel = (l: Level) => { setLevel(l); setSelected(null); setViewing(null); };
  const handleSelect = (code: string | null) => {
    if (code === null) { setSelected(null); return; } // 빈 영역 탭 → 닫기
    if (level !== 'sigungu') return;                  // 결정3: 시군구만 시트
    setSelected(code);
  };

  if (viewing) {
    return (
      <PhotoMapView photos={regionPhotos} title={names[viewing] ?? viewing} onBack={() => setViewing(null)} />
    );
  }

  const sheetState: VisitState = row?.state ?? 'notVisited';

  return (
    <div style={screen}>
      <LevelToggle level={level} onChange={changeLevel} />
      <StatHeader level={level} visitedCount={visitedCount} total={total} />
      <RegionMapView level={level} stateByCode={stateByCode} selectedCode={selected} onSelectRegion={handleSelect} />
      <Legend />
      {selected && (
        <RegionDetailSheet
          regionName={names[selected] ?? selected}
          state={sheetState}
          photoCount={row?.photoCount ?? 0}
          firstVisit={row?.firstVisit ?? null}
          lastVisit={row?.lastVisit ?? null}
          onToggleWantToGo={() => { void repo().setWantToGo(selected, sheetState !== 'wantToGo'); }}
          onViewPhotos={() => setViewing(selected)}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

const screen: CSSProperties = { position: 'relative', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 };
const loading: CSSProperties = {
  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--label2)',
};
