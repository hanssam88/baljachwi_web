'use client';

// src/components/region/RegionMapScreen.tsx — 지역지도 탭.
// MapLibre 지역지도 + 정복률 헤더 + 레벨 토글 + 범례 + 지역 클릭 상세 시트(가고싶음/사진 보기).

import { useState, type CSSProperties } from 'react';
import dynamic from 'next/dynamic';
import { StatCard } from '@/components/common/StatCard';
import { TYPE } from '@/lib/tokens';
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
      {/* 타이틀 · 레벨토글 · 정복 통계를 한 행에 — 세로 공간을 줄여 지도를 최대화. */}
      <header style={header} data-testid="region-header">
        <h1 style={titleText}>지역지도</h1>
        <LevelToggle level={level} onChange={changeLevel} />
        <StatCard
          dense
          value={visitedCount}
          unit={`/ ${total}`}
          label={`${levelLabel} 정복`}
          progress={{ current: visitedCount, total }}
        />
      </header>
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
// 한 행 헤더: 타이틀(좌) · 레벨토글(중) · 정복 통계(우) — space-between 으로 양끝 정렬.
const header: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  // flexWrap: 목표 폭(>=375px)에선 한 줄 유지. 초협소(~320px) 단말에서만 통계가 다음 줄로
  // 내려가 가로 오버플로를 막는 안전망(한 줄 배치를 깨지 않음).
  flexWrap: 'wrap',
  gap: 'var(--space-2)',
  padding: 'var(--space-2) var(--space-3) var(--space-1)',
};
const titleText: CSSProperties = {
  margin: 0,
  flexShrink: 0,
  fontSize: TYPE.title2.size,
  fontWeight: TYPE.title2.weight,
  lineHeight: 1.1,
  letterSpacing: '-0.5px',
  color: 'var(--label)',
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
