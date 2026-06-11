/** @type {import('next').NextConfig} */
// NEXT_PUBLIC_BASE_PATH 설정 시(예: /baljachwi_web)에만 GitHub Pages 정적 export 모드로 전환.
// 미설정(로컬 dev/일반 빌드)이면 아래 export 블록이 통째로 빠져 기존 동작 그대로.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const isPagesExport = basePath !== '';

const nextConfig = {
  reactStrictMode: true,
  // Phase 0: lint 미구성 — 빌드 게이트는 타입체크+vitest. ESLint는 후속 단계에서 도입.
  eslint: { ignoreDuringBuilds: true },
  ...(isPagesExport
    ? {
        output: 'export', // 정적 HTML/JS만 산출(서버 없음) → Pages 호스팅
        basePath, // 라우팅/링크에 /baljachwi_web 접두
        assetPrefix: basePath, // _next 정적 에셋·워커 URL에 동일 접두
        trailingSlash: true, // /baljachwi_web/ 디렉토리 라우팅(index.html)
        images: { unoptimized: true }, // export 모드 이미지 최적화 비활성(현재 next/image 미사용)
      }
    : {}),
};

export default nextConfig;
