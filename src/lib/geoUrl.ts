// src/lib/geoUrl.ts — Pages 하위경로 배포 시 정적 에셋 절대경로에 basePath를 붙인다.
// NEXT_PUBLIC_BASE_PATH 는 빌드 시 Next가 클라이언트·워커 번들에 인라인. 미설정(로컬 dev)이면 무변환.
export function geoUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
  return base + path;
}
