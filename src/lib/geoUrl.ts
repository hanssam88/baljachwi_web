// src/lib/geoUrl.ts — Pages 하위경로 배포 시 정적 에셋 절대경로에 basePath를 붙인다.
// NEXT_PUBLIC_BASE_PATH 는 빌드 시 Next가 클라이언트·워커 번들에 인라인. 미설정(로컬 dev)이면 무변환.
export function geoUrl(path: string): string {
  // 끝 슬래시 정규화: env를 '/baljachwi_web/'로 잘못 넣어도 '//geo/' 더블슬래시 방지(리뷰 반영).
  const base = (process.env.NEXT_PUBLIC_BASE_PATH ?? '').replace(/\/+$/, '');
  return base + path;
}
