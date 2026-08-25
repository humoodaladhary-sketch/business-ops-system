// Command Portal social pulse: the direct numbers from connected accounts.
// Reads the latest two snapshots per account (current + delta) and the
// 30-day posted count. Pure read — refreshing happens in the studio (and on
// the cron backbone once that phase lands). Null when no database.
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ORG_ID } from "../_departments/config";

export interface SocialPulseRow {
  accountId: string;
  platform: string;
  handle: string;
  status: string;
  followers: number | null;
  followersDelta: number | null;
  postsCount: number | null;
  capturedAt: string | null;
  source: "api" | "manual" | null;
}

export interface SocialPulse {
  rows: SocialPulseRow[];
  postedLast30: number;
}

export async function loadSocialPulse(): Promise<SocialPulse | null> {
  const db = supabaseAdmin();
  if (!db) return null;

  const [{ data: accounts }, { data: snapshots }, { count: postedLast30 }] = await Promise.all([
    db
      .from("social_accounts")
      .select("id,platform,handle,status")
      .eq("organization_id", ORG_ID)
      .order("platform"),
    db
      .from("social_metrics_snapshots")
      .select("account_id,captured_at,followers,posts_count,source")
      .eq("organization_id", ORG_ID)
      .order("captured_at", { ascending: false })
      .limit(400),
    db
      .from("social_posts")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", ORG_ID)
      .eq("status", "posted")
      .gte("posted_at", new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()),
  ]);
  if (!accounts || accounts.length === 0) return { rows: [], postedLast30: postedLast30 ?? 0 };

  const byAccount = new Map<string, { followers: number | null; posts: number | null; at: string; source: string }[]>();
  for (const snap of snapshots ?? []) {
    const list = byAccount.get(snap.account_id) ?? [];
    if (list.length < 2) {
      list.push({
        followers: snap.followers,
        posts: snap.posts_count,
        at: snap.captured_at,
        source: snap.source,
      });
      byAccount.set(snap.account_id, list);
    }
  }

  const rows: SocialPulseRow[] = accounts.map((a) => {
    const snaps = byAccount.get(a.id) ?? [];
    const latest = snaps[0];
    const prev = snaps[1];
    return {
      accountId: a.id,
      platform: a.platform,
      handle: a.handle,
      status: a.status,
      followers: latest?.followers ?? null,
      followersDelta:
        latest?.followers != null && prev?.followers != null ? latest.followers - prev.followers : null,
      postsCount: latest?.posts ?? null,
      capturedAt: latest?.at ?? null,
      source: (latest?.source as "api" | "manual") ?? null,
    };
  });

  return { rows, postedLast30: postedLast30 ?? 0 };
}
