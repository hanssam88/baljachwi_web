'use client';

// src/components/region/RegionMapScreen.tsx — 지역지도 탭.
// MapLibre 지역지도 + 정복률 헤더 + 레벨 토글 + 범례 + 지역 클릭 상세 시트(가고싶음/사진 보기).

import { useState, type CSSProperties } from 'react';
import dynamic from 'next/dynamic';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { StatCard } from '@/components/common/StatCard';
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
  const levelLabel = level === 'sigungu' ? '시군구' : '시도';

  return (
    <div style={screen}>
      <ScreenHeader title="지역지도" />
      <div style={controls}>
        <LevelToggle level={level} onChange={changeLevel} />
        <StatCard
          value={visitedCount}
          unit={`/ ${total}`}
          label={`${levelLabel} 정복`}
          progress={{ current: visitedCount, total }}
        />
      </div>
      <div style={mapFrame}>
        <RegionMapView level={level} stateByCode={stateByCode} selectedCode={selected} onSelectRegion={handleSelect} />
      </div>
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
const controls: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-2)',
  padding: '0 var(--space-3) var(--space-2)',
};
// 지도를 둥근 카드 프레임 안에 — Direction A 부드러운 코너. RegionMapView(flex:1)가 채운다.
const mapFrame: CSSProperties = {
  flex: 1,
  minHeight: 0,
  display: 'flex',
  margin: '0 var(--space-3) var(--space-2)',
  borderRadius: 'var(--radius-xl)',
  overflow: 'hidden',
  background: 'var(--surface2)',
};
const loading: CSSProperties = {
  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--label2)',
};
