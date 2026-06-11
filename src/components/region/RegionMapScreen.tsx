'use client';

// src/components/region/RegionMapScreen.tsx — 지역지도 탭.
// MapLibre 지역지도(RegionMapView, 지연 로드) + 정복률 헤더 + 레벨 토글 + 범례.
// iOS RegionMapScreen 대응(상세 시트/가고싶음은 프로토 제외).

import { useState, type CSSProperties } from 'react';
import dynamic from 'next/dynamic';
import { StatHeader } from '@/components/region/StatHeader';
import { LevelToggle, type Level } from '@/components/region/LevelToggle';
import { Legend } from '@/components/region/Legend';
import { useRegionStatuses } from '@/hooks/useRegionStatuses';
import { levelLayerConfig } from '@/lib/regionLayerStyle';

// maplibre는 RegionMapView에서만 로드 → 지역탭은 진입+동의 전까지 외부 호출 없음.
const RegionMapView = dynamic(
  () => import('@/components/region/RegionMapView').then((m) => m.RegionMapView),
  { ssr: false, loading: () => <div style={loading}>지도 불러오는 중…</div> },
);

export function RegionMapScreen() {
  const [level, setLevel] = useState<Level>('sigungu');
  const { sigungu, sido } = useRegionStatuses();

  const stateByCode = level === 'sigungu' ? sigungu : sido;
  const visitedCount = Object.values(stateByCode).filter((s) => s === 'visited').length;
  const total = levelLayerConfig(level).total;

  return (
    <div style={screen}>
      <LevelToggle level={level} onChange={setLevel} />
      <StatHeader level={level} visitedCount={visitedCount} total={total} />
      <RegionMapView level={level} stateByCode={stateByCode} />
      <Legend />
    </div>
  );
}

const screen: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  minHeight: 0,
};
const loading: CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--label2)',
};
