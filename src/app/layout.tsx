import type { Metadata, Viewport } from 'next';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: '발자취',
  description: '사진으로 그리는 나의 한국 여행 지도 — 모든 분석은 기기 안에서만',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Phase 0: 라이트 고정. 다크모드(prefers-color-scheme + db.meta)는 Phase 5.
  return (
    <html lang="ko" data-appearance="light">
      <body>{children}</body>
    </html>
  );
}
