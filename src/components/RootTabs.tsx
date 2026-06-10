'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { TYPE } from '@/lib/tokens';
import { useLive } from '@/hooks/useLive';
import { getDB } from '@/data/db';
import { ImportOnboarding } from '@/components/ImportOnboarding';
import { RegionMapScreen } from '@/components/region/RegionMapScreen';
import { TripListScreen } from '@/components/trip/TripListScreen';

type TabKey = 'region' | 'trip';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'region', label: '지역지도' },
  { key: 'trip', label: '경로지도' },
];

// WAI-ARIA tabs 패턴 — 탭↔패널 연결용 안정 id.
const PANEL_ID = 'root-tabpanel';
const tabId = (k: TabKey) => `tab-${k}`;

/**
 * iOS RootTabView 의 웹 대응 — 지역지도 / 경로지도 2탭 셸.
 * DB에 사진이 없으면 두 탭 모두 가져오기 온보딩을, 있으면 각 지도를 보여준다.
 * SSR 가드: 마운트 후에만 IndexedDB(useLive) 구독 — 프리렌더 단계 안전.
 */
export function RootTabs() {
  const [active, setActive] = useState<TabKey>('region');
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const photoCount = useLive(() => getDB().photoRefs.count(), []);
  const hasPhotos = (photoCount ?? 0) > 0;

  return (
    <div style={shell}>
      <main
        id={PANEL_ID}
        style={hasPhotos ? contentFill : content}
        role="tabpanel"
        aria-labelledby={tabId(active)}
        aria-label={TABS.find((t) => t.key === active)?.label}
      >
        {!mounted ? null : !hasPhotos ? (
          <ImportOnboarding />
        ) : active === 'region' ? (
          <RegionMapScreen />
        ) : (
          <TripListScreen />
        )}
      </main>

      <nav style={tabbar} role="tablist" aria-label="메인 탭">
        {TABS.map((t) => {
          const selected = active === t.key;
          return (
            <button
              key={t.key}
              id={tabId(t.key)}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={PANEL_ID}
              onClick={() => setActive(t.key)}
              style={{ ...tab, color: selected ? 'var(--accent)' : 'var(--label2)' }}
            >
              {t.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

const shell: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  minHeight: '100dvh',
};

// 온보딩(빈 상태)은 중앙 정렬, 지도(채움)는 전체 채움.
const content: CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 'var(--space-5)',
};

const contentFill: CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
};

const tabbar: CSSProperties = {
  display: 'flex',
  borderTop: '1px solid var(--separator)',
  background: 'var(--surface)',
  paddingBottom: 'env(safe-area-inset-bottom, 0px)',
};

const tab: CSSProperties = {
  flex: 1,
  border: 'none',
  background: 'transparent',
  padding: '12px 0',
  fontSize: TYPE.caption.size,
  fontWeight: 600,
};
