'use client';
// src/hooks/useThumbUrls.ts — id 목록 → 썸네일 objectURL 맵. 취소 가드 + 언마운트/ids변경 시 전량 revoke.
import { useEffect, useState } from 'react';
import { repo } from '@/data/repo';

/** ids 각각 썸네일 Blob → objectURL. 썸네일 없으면 키 생략. ids 집합(idsKey) 변경 시 재생성.
 *  의존성은 idsKey(문자열 안정 키)지만 effect 내부는 캡처된 ids 배열을 직접 순회 —
 *  id에 콤마가 있어도 안전(split 금지). 웹 포트 localIdentifier 포맷이 콤마 포함 가능성 있어 방어. */
export function useThumbUrls(ids: string[]): Record<string, string> {
  const idsKey = ids.join(',');
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    const created: string[] = [];
    const map: Record<string, string> = {};
    const r = repo();
    (async () => {
      for (const id of ids) {
        if (cancelled) break;
        const blob = await r.thumbFor(id).catch(() => null);
        if (cancelled) break;
        if (blob) {
          const url = URL.createObjectURL(blob);
          created.push(url);
          map[id] = url;
        }
      }
      if (!cancelled) setUrls({ ...map });
    })();
    return () => {
      cancelled = true;
      created.forEach((u) => URL.revokeObjectURL(u));
    };
    // idsKey로만 재실행 트리거(ids 배열 정체성 변동 무시) — 내부는 캡처된 ids 사용.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  return urls;
}
