'use client';

// src/components/region/Choropleth.tsx — 사전생성 SVG path 등고선 지도.
// region당 <path data-code data-state d> — 색은 순수 CSS(globals.css의 path[data-state]).
// 줌/팬: core/mapViewport affine을 <g transform=matrix>에 적용(wheel·drag·버튼).

import { useRef, useState, type CSSProperties, type WheelEvent, type PointerEvent } from 'react';
import type { VisitState } from '@/core/visitState';
import {
  makeMapViewport,
  viewportAffine,
  type MapViewport,
} from '@/core/mapViewport';

export interface RegionPath {
  code: string;
  name: string;
  d: string;
}

const STATE_LABEL: Record<VisitState, string> = {
  visited: '방문',
  wantToGo: '가고싶음',
  notVisited: '미방문',
};

const MIN_ZOOM = 1;
const MAX_ZOOM = 12;

/** viewBox "minX minY w h" → 중앙점(줌 고정점). */
function viewBoxCenter(viewBox: string): { x: number; y: number; w: number; h: number } {
  const [minX, minY, w, h] = viewBox.split(/\s+/).map(Number);
  return { x: minX + w / 2, y: minY + h / 2, w, h };
}

export function Choropleth({
  viewBox,
  regions,
  stateByCode,
  interactive = true,
}: {
  viewBox: string;
  regions: RegionPath[];
  stateByCode: Record<string, VisitState>;
  interactive?: boolean;
}) {
  const c = viewBoxCenter(viewBox);
  const [vp, setVp] = useState<MapViewport>(() =>
    makeMapViewport(1, { width: 0, height: 0 }, { x: c.x, y: c.y }),
  );
  const dragRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  const af = viewportAffine(vp);
  const matrix = `matrix(${af.a} ${af.b} ${af.c} ${af.d} ${af.tx} ${af.ty})`;

  const zoomBy = (factor: number) =>
    setVp((p) => ({
      ...p,
      zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, p.zoom * factor)),
    }));

  const onWheel = (e: WheelEvent<SVGSVGElement>) => {
    if (!interactive) return;
    zoomBy(e.deltaY < 0 ? 1.12 : 1 / 1.12);
  };

  const onPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    if (!interactive) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, panX: vp.pan.width, panY: vp.pan.height };
  };
  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    const d = dragRef.current;
    if (!d) return;
    // 화면 픽셀 이동 → viewBox 단위(대략 w/clientWidth 비율). 단순화: deltaclient 그대로 pan(점 공간).
    setVp((p) => ({
      ...p,
      pan: { width: d.panX + (e.clientX - d.x), height: d.panY + (e.clientY - d.y) },
    }));
  };
  const onPointerUp = () => {
    dragRef.current = null;
  };

  const reset = () =>
    setVp(makeMapViewport(1, { width: 0, height: 0 }, { x: c.x, y: c.y }));

  return (
    <div style={wrap}>
      <svg
        viewBox={viewBox}
        style={svg}
        role="img"
        aria-label="대한민국 방문 지도"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <g transform={matrix}>
          {regions.map((r) => {
            const state: VisitState = stateByCode[r.code] ?? 'notVisited';
            return (
              <path
                key={r.code}
                className="region"
                data-code={r.code}
                data-state={state}
                d={r.d}
                aria-label={`${r.name}, ${STATE_LABEL[state]}`}
                style={{ strokeWidth: 0.3 / vp.zoom }}
              />
            );
          })}
        </g>
      </svg>

      {interactive && (
        <div style={controls}>
          <button type="button" style={ctrlBtn} aria-label="확대" onClick={() => zoomBy(1.8)}>
            +
          </button>
          <button type="button" style={ctrlBtn} aria-label="축소" onClick={() => zoomBy(1 / 1.8)}>
            −
          </button>
          <button type="button" style={ctrlBtn} aria-label="초기화" onClick={reset}>
            ⤢
          </button>
        </div>
      )}
    </div>
  );
}

const wrap: CSSProperties = { position: 'relative', flex: 1, minHeight: 0, overflow: 'hidden' };
const svg: CSSProperties = {
  width: '100%',
  height: '100%',
  touchAction: 'none',
  cursor: 'grab',
  display: 'block',
};
const controls: CSSProperties = {
  position: 'absolute',
  right: 'var(--space-3)',
  bottom: 'var(--space-3)',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-1)',
};
const ctrlBtn: CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--separator)',
  background: 'var(--surface)',
  color: 'var(--label)',
  fontSize: 18,
  cursor: 'pointer',
};
