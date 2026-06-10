'use client';

import { useState, type CSSProperties } from 'react';
import { TYPE } from '@/lib/tokens';

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
 * Phase 0: 가져온 사진이 없으므로 두 탭 모두 가져오기 빈 상태(ScanStateGate)를 보여준다.
 * Phase 2에서 ImportOnboarding(파일 선택/드롭존)과 실제 지도가 연결된다.
 */
export function RootTabs() {
  const [active, setActive] = useState<TabKey>('region');

  return (
    <div style={shell}>
      <main
        id={PANEL_ID}
        style={content}
        role="tabpanel"
        aria-labelledby={tabId(active)}
        aria-label={TABS.find((t) => t.key === active)?.label}
      >
        <EmptyImportState />
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

function EmptyImportState() {
  return (
    <div style={empty}>
      <p style={emptyTitle}>아직 가져온 사진이 없습니다</p>
      <p style={emptySub}>사진을 가져오면 지역지도와 경로지도가 채워집니다</p>
    </div>
  );
}

const shell: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  minHeight: '100dvh',
};

const content: CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 'var(--space-5)',
};

const empty: CSSProperties = {
  textAlign: 'center',
  maxWidth: 320,
};

const emptyTitle: CSSProperties = {
  margin: 0,
  fontSize: TYPE.headline.size,
  fontWeight: TYPE.headline.weight,
  lineHeight: TYPE.headline.lineHeight,
  color: 'var(--label)',
};

const emptySub: CSSProperties = {
  marginTop: 'var(--space-2)',
  marginBottom: 0,
  fontSize: TYPE.subheadline.size,
  lineHeight: TYPE.subheadline.lineHeight,
  color: 'var(--label2)',
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
