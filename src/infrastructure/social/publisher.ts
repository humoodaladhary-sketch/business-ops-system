// Social publisher adapters. The OS talks to every platform through ONE
// interface so the dashboard never couples to a provider; platforms without
// an implemented adapter return an honest "pending credentials/adapter"
// result instead of pretending. Server-only — tokens never reach the client.
import type { SocialPlatform } from "@/domain/social/platforms";

export interface AccountRef {
  platform: SocialPlatform;
  handle: string;
  /** Page ID / IG business ID / channel ID — platform-specific. */
  externalAccountId: string | null;
}

export interface VerifyResult {
  ok: boolean;
  detail: string;
  /** Display name reported by the platform when verification succeeds. */
  accountName?: string;
}

export interface PublishRequest {
  account: AccountRef;
  accessToken: string;
  body: string;
  linkUrl?: string | null;
  /** Publicly-fetchable (signed) image URLs, in display order. */
  imageUrls: string[];
}

export interface PublishResult {
  ok: boolean;
  externalPostId?: string;
  error?: string;
}

export interface MetricsResult {
  ok: boolean;
  followers?: number | null;
  postsCount?: number | null;
  /** Platform-specific extras stored in the snapshot's jsonb. */
  extra?: Record<string, number | string | null>;
  error?: string;
}

export interface SocialPublisher {
  /** Read-only credential/account check — safe for dry runs. */
  verify(account: AccountRef, accessToken: string): Promise<VerifyResult>;
  /** Performs the real-world post. Only called after a passed dry run. */
  publish(request: PublishRequest): Promise<PublishResult>;
  /** Read-only account metrics (followers etc.) for the dashboard. */
  fetchMetrics(account: AccountRef, accessToken: string): Promise<MetricsResult>;
}

// ---------------------------------------------------------------------------
// Meta Graph (Facebook Page + Instagram Business) — native
// ---------------------------------------------------------------------------

const GRAPH = "https://graph.facebook.com/v21.0";

async function graph<T>(
  path: string,
  token: string,
  init?: { method?: "GET" | "POST"; params?: Record<string, string> },
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const qs = new URLSearchParams({ ...(init?.params ?? {}), access_token: token });
    const url =
      init?.method === "POST" ? `${GRAPH}${path}` : `${GRAPH}${path}?${qs.toString()}`;
    const res = await fetch(url, {
      method: init?.method ?? "GET",
      ...(init?.method === "POST"
        ? { headers: { "content-type": "application/x-www-form-urlencoded" }, body: qs.toString() }
        : {}),
      signal: AbortSignal.timeout(20000),
    });
    const json = (await res.json()) as T & { error?: { message?: string } };
    if (!res.ok || json?.error) {
      return { ok: false, error: json?.error?.message?.slice(0, 300) ?? `HTTP ${res.status}` };
    }
    return { ok: true, data: json };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message.slice(0, 300) : "network error" };
  }
}

export const metaPublisher: SocialPublisher = {
  async verify(account, accessToken) {
    if (!account.externalAccountId) {
      return { ok: false, detail: "Missing Page/Business account ID." };
    }
    const field = account.platform === "instagram" ? "username" : "name";
    const r = await graph<{ name?: string; username?: string }>(
      `/${account.externalAccountId}`,
      accessToken,
      { params: { fields: field } },
    );
    if (!r.ok) return { ok: false, detail: r.error };
    const accountName = r.data.username ?? r.data.name ?? account.handle;
    return { ok: true, detail: `Verified as ${accountName}.`, accountName };
  },

  async publish(req) {
    const id = req.account.externalAccountId;
    if (!id) return { ok: false, error: "Missing account ID" };

    if (req.account.platform === "facebook") {
      // Photos: upload unpublished, then attach to one feed post.
      if (req.imageUrls.length === 1) {
        const r = await graph<{ post_id?: string; id?: string }>(`/${id}/photos`, req.accessToken, {
          method: "POST",
          params: { url: req.imageUrls[0], caption: req.body },
        });
        return r.ok
          ? { ok: true, externalPostId: r.data.post_id ?? r.data.id }
          : { ok: false, error: r.error };
      }
      const mediaIds: string[] = [];
      for (const url of req.imageUrls) {
        const up = await graph<{ id: string }>(`/${id}/photos`, req.accessToken, {
          method: "POST",
          params: { url, published: "false" },
        });
        if (!up.ok) return { ok: false, error: `photo upload: ${up.error}` };
        mediaIds.push(up.data.id);
      }
      const params: Record<string, string> = { message: req.body };
      if (req.linkUrl) params.link = req.linkUrl;
      mediaIds.forEach((m, i) => (params[`attached_media[${i}]`] = JSON.stringify({ media_fbid: m })));
      const post = await graph<{ id: string }>(`/${id}/feed`, req.accessToken, {
        method: "POST",
        params,
      });
      return post.ok ? { ok: true, externalPostId: post.data.id } : { ok: false, error: post.error };
    }

    if (req.account.platform === "instagram") {
      // IG container flow: create container(s), then publish.
      if (req.imageUrls.length === 0) return { ok: false, error: "Instagram requires an image" };
      const containers: string[] = [];
      for (const url of req.imageUrls) {
        const params: Record<string, string> =
          req.imageUrls.length === 1
            ? { image_url: url, caption: req.body }
            : { image_url: url, is_carousel_item: "true" };
        const c = await graph<{ id: string }>(`/${id}/media`, req.accessToken, {
          method: "POST",
          params,
        });
        if (!c.ok) return { ok: false, error: `container: ${c.error}` };
        containers.push(c.data.id);
      }
      let creationId = containers[0];
      if (containers.length > 1) {
        const carousel = await graph<{ id: string }>(`/${id}/media`, req.accessToken, {
          method: "POST",
          params: { media_type: "CAROUSEL", children: containers.join(","), caption: req.body },
        });
        if (!carousel.ok) return { ok: false, error: `carousel: ${carousel.error}` };
        creationId = carousel.data.id;
      }
      const pub = await graph<{ id: string }>(`/${id}/media_publish`, req.accessToken, {
        method: "POST",
        params: { creation_id: creationId },
      });
      return pub.ok ? { ok: true, externalPostId: pub.data.id } : { ok: false, error: pub.error };
    }

    return { ok: false, error: `Meta adapter does not handle ${req.account.platform}` };
  },

  async fetchMetrics(account, accessToken) {
    const id = account.externalAccountId;
    if (!id) return { ok: false, error: "Missing account ID" };
    if (account.platform === "facebook") {
      const r = await graph<{ fan_count?: number; followers_count?: number }>(`/${id}`, accessToken, {
        params: { fields: "fan_count,followers_count" },
      });
      if (!r.ok) return { ok: false, error: r.error };
      return {
        ok: true,
        followers: r.data.followers_count ?? r.data.fan_count ?? null,
        postsCount: null,
        extra: { fanCount: r.data.fan_count ?? null },
      };
    }
    if (account.platform === "instagram") {
      const r = await graph<{ followers_count?: number; media_count?: number }>(`/${id}`, accessToken, {
        params: { fields: "followers_count,media_count" },
      });
      if (!r.ok) return { ok: false, error: r.error };
      return { ok: true, followers: r.data.followers_count ?? null, postsCount: r.data.media_count ?? null };
    }
    return { ok: false, error: `Meta adapter does not handle ${account.platform}` };
  },
};

// ---------------------------------------------------------------------------
// Pending platforms — honest stub, never a fake success
// ---------------------------------------------------------------------------

export function pendingPublisher(platform: SocialPlatform): SocialPublisher {
  const msg = `No native adapter for ${platform} yet — connection is registered, publishing activates when the adapter ships (see the connect checklist).`;
  return {
    async verify() {
      return { ok: false, detail: msg };
    },
    async publish() {
      return { ok: false, error: msg };
    },
    async fetchMetrics() {
      return { ok: false, error: msg };
    },
  };
}

/** Adapter registry — the only place the app resolves a platform to code. */
export function publisherFor(platform: SocialPlatform): SocialPublisher {
  if (platform === "facebook" || platform === "instagram") return metaPublisher;
  return pendingPublisher(platform);
}
