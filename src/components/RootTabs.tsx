'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { TYPE } from '@/lib/tokens';
import { useLive } from '@/hooks/useLive';
import { getDB } from '@/data/db';
import { ImportOnboarding } from '@/components/ImportOnboarding';
import { RegionMapScreen } from '@/components/region/RegionMapScreen';
import { RouteMapScreen } from '@/components/trip/RouteMapScreen';
import { TripListScreen } from '@/components/trip/TripListScreen';
import { Icon, type IconName } from '@/components/common/Icon';

type TabKey = 'region' | 'route' | 'trips';

const TABS: { key: TabKey; label: string; icon: IconName }[] = [
  { key: 'region', label: '지역지도', icon: 'region' },
  { key: 'route', label: '경로지도', icon: 'route' },
  { key: 'trips', label: '여행 목록', icon: 'list' },
];

// WAI-ARIA tabs 패턴 — 탭↔패널 연결용 안정 id.
const PANEL_ID = 'root-tabpanel';
const tabId = (k: TabKey) => `tab-${k}`;

/**
 * iOS RootTabView 의 웹 대응 — 지역지도 / 경로지도 / 여행 목록 3탭 셸.
 * DB에 사진이 없으면 모든 탭이 가져오기 온보딩을, 있으면 각 화면을 보여준다.
 * SSR 가드: 마운트 후에만 IndexedDB(useLive) 구독 — 프리렌더 단계 안전.
 */
export function RootTabs() {
  const [active, setActive] = useState<TabKey>('region');
  const [reimport, setReimport] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const photoCount = useLive(() => getDB().photoRefs.count(), []);
  const hasPhotos = (photoCount ?? 0) > 0;
  // 첫 온보딩(사진 없음) 또는 재업로드 진입 시 중앙정렬 카드 레이아웃.
  const showOnboarding = !hasPhotos || reimport;

  return (
    <div style={shell}>
      {hasPhotos && (
        <header style={topbar}>
          <button type="button" style={topBtn} onClick={() => setReimport((v) => !v)}>
            <Icon name={reimport ? 'chevronLeft' : 'upload'} size={18} />
            {reimport ? '지도로' : '사진 업로드'}
          </button>
        </header>
      )}

      <main
        id={PANEL_ID}
        style={showOnboarding ? content : contentFill}
        role="tabpanel"
        aria-labelledby={tabId(active)}
        aria-label={TABS.find((t) => t.key === active)?.label}
      >
        {!mounted ? null : !hasPhotos ? (
          <ImportOnboarding />
        ) : reimport ? (
          <ImportOnboarding mode="apply" onImported={() => setReimport(false)} />
        ) : active === 'region' ? (
          <RegionMapScreen />
        ) : active === 'route' ? (
          <RouteMapScreen />
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
              onClick={() => {
                // 재업로드 중 탭 클릭 = 해당 지도 보기 의도 → reimport 해제 후 전환(리뷰 반영).
                setReimport(false);
                setActive(t.key);
              }}
              style={{ ...tab, color: selected ? 'var(--accent)' : 'var(--label2)' }}
            >
              <Icon name={t.icon} size={24} strokeWidth={selected ? 2 : 1.8} />
              <span style={tabLabel}>{t.label}</span>
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

// 상단 헤더(사진 있을 때 양쪽 탭 공통) — 재업로드 토글 버튼.
const topbar: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: 'var(--space-2) var(--space-3)',
  borderBottom: '1px solid var(--separator)',
  background: 'var(--surface)',
};
const topBtn: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--space-1)',
  border: 'none',
  background: 'transparent',
  color: 'var(--accent)',
  fontSize: 15,
  fontWeight: 600,
  cursor: 'pointer',
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
  // 반투명 surface + blur backdrop(Direction A) — 지도 위에 떠 있는 탭바 느낌.
  background: 'color-mix(in srgb, var(--surface) 82%, transparent)',
  backdropFilter: 'saturate(180%) blur(20px)',
  WebkitBackdropFilter: 'saturate(180%) blur(20px)',
  paddingBottom: 'env(safe-area-inset-bottom, 0px)',
};

const tab: CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 3,
  border: 'none',
  background: 'transparent',
  padding: '8px 0 7px',
  cursor: 'pointer',
};

const tabLabel: CSSProperties = {
  fontSize: TYPE.caption.size,
  fontWeight: 600,
  lineHeight: 1,
};
