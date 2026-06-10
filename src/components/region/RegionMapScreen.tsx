'use client';

// src/components/region/RegionMapScreen.tsx — 지역지도 탭.
// 사전생성 SVG path(/geo/korea-{level}.paths.json) + 정복률 헤더 + 레벨 토글 + 범례.
// iOS RegionMapScreen 대응(상세 시트/가고싶음은 프로토 제외).

import { useEffect, useState, type CSSProperties } from 'react';
import { Choropleth, type RegionPath } from '@/components/region/Choropleth';
import { StatHeader } from '@/components/region/StatHeader';
import { LevelToggle, type Level } from '@/components/region/LevelToggle';
import { Legend } from '@/components/region/Legend';
import { useRegionStatuses } from '@/hooks/useRegionStatuses';

interface PathsArtifact {
  viewBox: string;
  regions: RegionPath[];
}

const TOTAL: Record<Level, number> = { sigungu: 255, sido: 17 };

export function RegionMapScreen() {
  const [level, setLevel] = useState<Level>('sigungu');
  const [paths, setPaths] = useState<Record<Level, PathsArtifact | null>>({
    sigungu: null,
    sido: null,
  });
  const { sigungu, sido } = useRegionStatuses();

  // 레벨별 path 아티팩트 lazy fetch(1회). 지역탭은 외부 호출 없이 same-origin 정적 자산만.
  useEffect(() => {
    if (paths[level]) return;
    let alive = true;
    fetch(`/geo/korea-${level}.paths.json`)
      .then((r) => r.json())
      .then((data: PathsArtifact) => {
        if (alive) setPaths((p) => ({ ...p, [level]: data }));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [level, paths]);

  const stateByCode = level === 'sigungu' ? sigungu : sido;
  const visitedCount = Object.values(stateByCode).filter((s) => s === 'visited').length;
  const artifact = paths[level];

  return (
    <div style={screen}>
      <LevelToggle level={level} onChange={setLevel} />
      <StatHeader level={level} visitedCount={visitedCount} total={TOTAL[level]} />
      {artifact ? (
        <Choropleth
          key={level} // 레벨 전환 시 줌/팬 리셋(iOS .id(level))
          viewBox={artifact.viewBox}
          regions={artifact.regions}
          stateByCode={stateByCode}
          interactive={level === 'sigungu'} // 시도는 표시 전용
        />
      ) : (
        <div style={loading}>지도 불러오는 중…</div>
      )}
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
