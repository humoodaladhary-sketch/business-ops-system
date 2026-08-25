// Hero-slide scheduling & ordering. Pure and deterministic.
//
// A slide is visible when: published · its window contains `now` · its
// audience includes the viewer. Order: pinned first, then priority (lower
// first), then newest. The carousel is capped so the portal never downloads
// an unbounded image set.
export interface ScheduledSlide {
  id: string;
  status: "draft" | "published" | "archived";
  startsAt: string | null; // ISO
  endsAt: string | null; // ISO
  pinned: boolean;
  priority: number;
  audience: "all" | "admin" | "agents";
  createdAt: string;
}

export const MAX_HERO_SLIDES = 6;

/** True when the slide should be visible at `now` for the given role. */
export function isSlideActive(
  slide: ScheduledSlide,
  now: Date,
  viewerRole: "ADMIN" | "AGENT",
): boolean {
  if (slide.status !== "published") return false;
  if (slide.audience === "admin" && viewerRole !== "ADMIN") return false;
  if (slide.audience === "agents" && viewerRole !== "AGENT") return false;
  const t = now.getTime();
  if (slide.startsAt) {
    const start = Date.parse(slide.startsAt);
    if (!Number.isNaN(start) && t < start) return false;
  }
  if (slide.endsAt) {
    const end = Date.parse(slide.endsAt);
    if (!Number.isNaN(end) && t >= end) return false;
  }
  return true;
}

/**
 * Active slides in display order: pinned → priority asc → newest → id.
 * Capped at `limit` (default MAX_HERO_SLIDES).
 */
export function orderSlides<T extends ScheduledSlide>(
  slides: T[],
  now: Date,
  viewerRole: "ADMIN" | "AGENT",
  limit = MAX_HERO_SLIDES,
): T[] {
  return slides
    .filter((s) => isSlideActive(s, now, viewerRole))
    .sort(
      (a, b) =>
        Number(b.pinned) - Number(a.pinned) ||
        a.priority - b.priority ||
        b.createdAt.localeCompare(a.createdAt) ||
        a.id.localeCompare(b.id),
    )
    .slice(0, Math.max(0, limit));
}
