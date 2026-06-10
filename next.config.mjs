/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Phase 0: lint 미구성 — 빌드 게이트는 타입체크+vitest. ESLint는 후속 단계에서 도입.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
