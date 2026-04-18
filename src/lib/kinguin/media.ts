import type { KinguinProductJson } from './types';

/** Ordered gallery: cover first, then screenshots (deduped URLs). */
export function extractGalleryUrls(p: KinguinProductJson): string[] {
  const urls: string[] = [];
  const add = (u: string | undefined | null) => {
    const s = u?.trim();
    if (s && !urls.includes(s)) urls.push(s);
  };
  const cover = p.images?.cover;
  add(cover?.url ?? cover?.thumbnail);
  for (const sh of p.images?.screenshots ?? []) {
    add(sh?.url ?? sh?.thumbnail);
  }
  return urls;
}

export function extractYoutubeIds(p: KinguinProductJson): string[] {
  const ids: string[] = [];
  for (const v of p.videos ?? []) {
    const id = v.video_id?.trim();
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}
