'use client';

// src/components/trip/TripMapView.tsx — 여행 경로지도. 공유 PhotoMapView에 위임(핀 클릭 시 같은-날 연결선).
import type { TripRecord } from '@/data/models';
import { usePhotosForTrip } from '@/hooks/useTrips';
import { PhotoMapView } from '@/components/trip/PhotoMapView';

export function TripMapView({ trip, onBack }: { trip: TripRecord; onBack: () => void }) {
  const photos = usePhotosForTrip(trip.id) ?? [];
  return <PhotoMapView photos={photos} onBack={onBack} title={trip.title ?? '여행'} />;
}
