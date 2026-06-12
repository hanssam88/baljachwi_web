'use client';

// src/components/trip/RouteMapScreen.tsx — 경로지도 탭. 전체 사진을 핀으로 표시(클릭 시 같은-날 연결선).
import { type CSSProperties } from 'react';
import dynamic from 'next/dynamic';
import { useAllPhotos } from '@/hooks/useTrips';

const PhotoMapView = dynamic(
  () => import('@/components/trip/PhotoMapView').then((m) => m.PhotoMapView),
  { ssr: false, loading: () => <div style={center}>지도 불러오는 중…</div> },
);

export function RouteMapScreen() {
  const photos = useAllPhotos();
  if (photos === undefined) return <div style={center}>불러오는 중…</div>;
  if (photos.length === 0) return <div style={center}>아직 표시할 사진이 없습니다</div>;
  return <PhotoMapView photos={photos} hint="핀을 탭하면 같은 날 경로가 이어져요" />;
}

const center: CSSProperties = {
  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--label2)',
};
