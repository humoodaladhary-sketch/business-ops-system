import { describe, it, expect } from "vitest";
import { ALL_PLATFORMS, PLATFORMS } from "./platforms";
import {
  canPublishLive,
  canTransition,
  postIdempotencyKey,
  resolveDraftWrite,
  validatePost,
} from "./posting";

describe("platform registry", () => {
  it("covers all 8 platforms with connect requirements", () => {
    expect(ALL_PLATFORMS).toHaveLength(8);
    for (const p of ALL_PLATFORMS) {
      expect(PLATFORMS[p].connectRequirements.length).toBeGreaterThan(0);
      expect(PLATFORMS[p].maxBodyLength).toBeGreaterThan(0);
    }
  });

  it("only Meta surfaces publish natively today (honest capability flags)", () => {
    expect(PLATFORMS.facebook.nativePublish).toBe(true);
    expect(PLATFORMS.instagram.nativePublish).toBe(true);
    for (const p of ["tiktok", "youtube", "linkedin", "x", "threads", "whatsapp"] as const) {
      expect(PLATFORMS[p].nativePublish).toBe(false);
    }
  });
});

describe("validatePost", () => {
  const base = { accountId: "a1", body: "New ITC launch at Al Mouj", linkUrl: null, mediaCount: 1 };

  it("passes a normal Facebook post and an IG post with media", () => {
    expect(validatePost({ ...base, platform: "facebook" }).ok).toBe(true);
    expect(validatePost({ ...base, platform: "instagram" }).ok).toBe(true);
  });

  it("Instagram requires media; empty posts rejected everywhere", () => {
    const noMedia = validatePost({ ...base, platform: "instagram", mediaCount: 0 });
    expect(noMedia.ok).toBe(false);
    expect(noMedia.errors[0]).toContain("requires at least one image");
    expect(validatePost({ platform: "facebook", accountId: "a", body: "  ", mediaCount: 0 }).ok).toBe(false);
  });

  it("enforces per-platform length (X 280) and image caps", () => {
    const long = validatePost({ ...base, platform: "x", body: "a".repeat(300) });
    expect(long.ok).toBe(false);
    expect(long.errors[0]).toContain("280");
    const many = validatePost({ ...base, platform: "x", mediaCount: 5 });
    expect(many.ok).toBe(false);
  });

  it("warns (not errors) for links on platforms that render them as plain text", () => {
    const r = validatePost({ ...base, platform: "instagram", linkUrl: "https://alwalaa.om" });
    expect(r.ok).toBe(true);
    expect(r.warnings[0]).toContain("plain text");
    expect(validatePost({ ...base, platform: "facebook", linkUrl: "notaurl" }).ok).toBe(false);
  });
});

describe("postIdempotencyKey", () => {
  it("is deterministic and insensitive to media order / body whitespace", () => {
    const a = postIdempotencyKey({ accountId: "acct-1234", body: "Hello ", mediaFileIds: ["m1", "m2"] });
    const b = postIdempotencyKey({ accountId: "acct-1234", body: "Hello", mediaFileIds: ["m2", "m1"] });
    expect(a).toBe(b);
  });

  it("differs across accounts and content", () => {
    const base = { accountId: "acct-1234", body: "Hello", mediaFileIds: [] };
    expect(postIdempotencyKey(base)).not.toBe(postIdempotencyKey({ ...base, accountId: "acct-9999" }));
    expect(postIdempotencyKey(base)).not.toBe(postIdempotencyKey({ ...base, body: "Hello!" }));
    expect(postIdempotencyKey(base)).not.toBe(postIdempotencyKey({ ...base, mediaFileIds: ["m1"] }));
  });
});

describe("post state machine", () => {
  it("live publishing is only reachable through a passed dry-run", () => {
    expect(canPublishLive("draft")).toBe(false);
    expect(canPublishLive("scheduled")).toBe(false);
    expect(canPublishLive("dry_run_ok")).toBe(true);
    expect(canTransition("draft", "posting")).toBe(false);
    expect(canTransition("draft", "dry_run_ok")).toBe(true);
    expect(canTransition("dry_run_ok", "posting")).toBe(true);
  });

  it("posted and cancelled are terminal; failed can be fixed and retried", () => {
    expect(canTransition("posted", "draft")).toBe(false);
    expect(canTransition("cancelled", "draft")).toBe(false);
    expect(canTransition("failed", "dry_run_ok")).toBe(true);
    expect(canTransition("posting", "posted")).toBe(true);
    expect(canTransition("posting", "failed")).toBe(true);
  });
});

describe("resolveDraftWrite", () => {
  const posted = { id: "live-1", status: "posted" as const };

  it("refuses to write over a published post that shares the content key", () => {
    // Re-composing identical content must never reset published history.
    expect(resolveDraftWrite({ existing: posted })).toEqual({
      action: "reject_already_posted",
      id: "live-1",
    });
  });

  it("still refuses when the caller is editing a different post", () => {
    expect(resolveDraftWrite({ requestedId: "other", existing: posted })).toEqual({
      action: "reject_already_posted",
      id: "live-1",
    });
  });

  it("updates in place when the collision is an unpublished draft", () => {
    expect(resolveDraftWrite({ existing: { id: "d1", status: "dry_run_ok" } })).toEqual({
      action: "update",
      id: "d1",
    });
  });

  it("updates the requested post when one was named", () => {
    expect(resolveDraftWrite({ requestedId: "d9" })).toEqual({ action: "update", id: "d9" });
  });

  it("inserts when nothing collides", () => {
    expect(resolveDraftWrite({})).toEqual({ action: "insert" });
  });
});
