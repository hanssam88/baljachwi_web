'use client';

// src/components/trip/TripRow.tsx — 여행 목록 한 행(제목/지역요약 + 날짜 + 사진수).

import type { CSSProperties } from 'react';
import { TYPE } from '@/lib/tokens';
import type { TripRecord } from '@/data/models';
import { usePhotosForTrip } from '@/hooks/useTrips';
import { tripDisplayName } from '@/components/trip/tripLabel';

/** epoch 초 → "YYYY. M. D." (UI 경계라 Date 허용). */
function formatDate(epochSec: number): string {
  const d = new Date(epochSec * 1000);
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;
}

export function TripRow({
  trip,
  names,
  onOpen,
}: {
  trip: TripRecord;
  names: Record<string, string>;
  onOpen: (trip: TripRecord) => void;
}) {
  const photos = usePhotosForTrip(trip.id) ?? [];
  const title = tripDisplayName(trip.title, photos, names);

  return (
    <button type="button" style={row} onClick={() => onOpen(trip)}>
      <span style={name}>{title}</span>
      <span style={meta}>
        {formatDate(trip.startAt)} · {photos.length}장
      </span>
    </button>
  );
}

const row: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: 4,
  width: '100%',
  padding: 'var(--space-3) var(--space-4)',
  border: 'none',
  borderBottom: '1px solid var(--separator)',
  background: 'var(--surface)',
  textAlign: 'left',
  cursor: 'pointer',
};
const name: CSSProperties = {
  fontSize: TYPE.headline.size,
  fontWeight: TYPE.headline.weight,
  color: 'var(--label)',
};
const meta: CSSProperties = {
  fontSize: TYPE.subheadline.size,
  color: 'var(--label2)',
};
