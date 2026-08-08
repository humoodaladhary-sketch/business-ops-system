"use client";

// Social studio: connection cards for all 8 platforms (status, verify,
// connect checklist), a composer with platform-aware validation feedback,
// the dry-run → publish flow, and post history. Tokens are write-only from
// this UI — the API never returns them.
/* eslint-disable @next/next/no-img-element -- media previews use short-lived
   signed URLs. */
import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  CircleSlash,
  Link2,
  PlugZap,
  RefreshCw,
  Send,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { Card } from "../../components/ui";
import { cn } from "../../lib/cn";

const FIELD =
  "w-full rounded-md border border-hairline bg-ink-100 px-2.5 py-2 text-sm text-white placeholder:text-white/30 focus:border-gold/50 focus:outline-none";
const LABEL = "mb-1 block text-[11px] uppercase tracking-wide text-white/45";

interface PlatformSpec {
  platform: string;
  label: string;
  nativePublish: boolean;
  maxBodyLength: number;
  requiresMedia: boolean;
  connectRequirements: string[];
}

interface AccountRow {
  id: string;
  platform: string;
  handle: string;
  display_name: string | null;
  external_account_id: string | null;
  status: string;
  status_detail: string | null;
  last_verified_at: string | null;
  has_token: boolean;
  token_expires_at: string | null;
}

interface PostRow {
  id: string;
  account_id: string;
  body: string;
  link_url: string | null;
  media_file_ids: string[];
  status: string;
  posted_at: string | null;
  external_post_id: string | null;
  error: string | null;
  dry_run_at: string | null;
  created_at: string;
  social_accounts: { platform: string; handle: string } | null;
}

interface MediaRow {
  id: string;
  filename: string;
  approval_status: string;
  license_allows_hero: boolean;
  preview_url: string | null;
  alt_text: string | null;
}

export function SocialStudio() {
  const [platforms, setPlatforms] = useState<PlatformSpec[]>([]);
  const [accounts, setAccounts] = useState<AccountRow[] | null>(null);
  const [posts, setPosts] = useState<PostRow[] | null>(null);
  const [media, setMedia] = useState<MediaRow[]>([]);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [connectOpen, setConnectOpen] = useState<string | null>(null); // platform key
  // Connect form
  const [cHandle, setCHandle] = useState("");
  const [cExternalId, setCExternalId] = useState("");
  const [cToken, setCToken] = useState("");
  const [busy, setBusy] = useState(false);
  // Composer
  const [pAccount, setPAccount] = useState("");
  const [pBody, setPBody] = useState("");
  const [pLink, setPLink] = useState("");
  const [pMedia, setPMedia] = useState<string[]>([]);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [dryRunInfo, setDryRunInfo] = useState<string | null>(null);

  const say = (kind: "ok" | "err", text: string) => {
    setNotice({ kind, text });
    setTimeout(() => setNotice(null), 6000);
  };

  const refresh = useCallback(async () => {
    const [a, p, m] = await Promise.all([
      fetch("/api/social/accounts").then((r) => r.json()).catch(() => null),
      fetch("/api/social/posts").then((r) => r.json()).catch(() => null),
      fetch("/api/media/assets").then((r) => r.json()).catch(() => null),
    ]);
    if (a?.platforms) setPlatforms(a.platforms);
    setAccounts(a?.accounts ?? []);
    setPosts(p?.posts ?? []);
    setMedia(
      (m?.assets ?? []).filter(
        (x: MediaRow) => x.approval_status === "approved" && x.license_allows_hero,
      ),
    );
    if (a?.setup) say("err", "Storage not configured — the studio is read-only.");
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);

  async function connect(platform: string) {
    setBusy(true);
    try {
      const existing = accounts?.find((x) => x.platform === platform && x.handle === cHandle);
      const r = await fetch("/api/social/accounts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: existing?.id,
          platform,
          handle: cHandle,
          externalAccountId: cExternalId || undefined,
          accessToken: cToken || undefined,
        }),
      });
      const j = await r.json();
      if (j.saved) {
        say(j.saved.status === "connected" ? "ok" : "err", j.saved.detail);
        setConnectOpen(null);
        setCHandle("");
        setCExternalId("");
        setCToken("");
        refresh();
      } else {
        say("err", j.detail ?? j.error ?? "Connect failed");
      }
    } finally {
      setBusy(false);
    }
  }

  async function saveDraft(): Promise<string | null> {
    const r = await fetch("/api/social/posts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: draftId ?? undefined,
        accountId: pAccount,
        body: pBody,
        linkUrl: pLink || null,
        mediaFileIds: pMedia,
      }),
    });
    const j = await r.json();
    if (j.saved) {
      setDraftId(j.saved.id);
      if (j.warnings?.length) say("ok", `Draft saved — note: ${j.warnings.join("; ")}`);
      refresh();
      return j.saved.id;
    }
    say("err", j.detail ?? j.error ?? "Save failed");
    return null;
  }

  async function dryRun() {
    const id = await saveDraft();
    if (!id) return;
    setBusy(true);
    setDryRunInfo(null);
    try {
      const r = await fetch("/api/social/posts/publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, mode: "dry_run" }),
      });
      const j = await r.json();
      if (j.ok) {
        setDryRunInfo(
          `Dry run passed — would post to ${j.wouldPost.platform} as ${j.wouldPost.verifiedAs}: ${j.wouldPost.images} image(s), ${j.wouldPost.bodyPreview.length} chars${j.wouldPost.link ? ", 1 link" : ""}. Nothing was published.`,
        );
        refresh();
      } else {
        say("err", j.detail ?? j.error ?? "Dry run failed");
      }
    } finally {
      setBusy(false);
    }
  }

  async function publishLive() {
    if (!draftId) return;
    setBusy(true);
    try {
      const r = await fetch("/api/social/posts/publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: draftId, mode: "live" }),
      });
      const j = await r.json();
      if (j.ok) {
        say("ok", j.alreadyPosted ? "Already posted (idempotent) — no duplicate created." : `Published — platform id ${j.externalPostId ?? "n/a"}.`);
        setDraftId(null);
        setPBody("");
        setPLink("");
        setPMedia([]);
        setDryRunInfo(null);
        refresh();
      } else {
        say("err", j.detail ?? j.error ?? "Publish failed");
        refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  const connected = (accounts ?? []).filter((a) => a.status === "connected");
  const selectedPost = posts?.find((p) => p.id === draftId);
  const canGoLive = selectedPost?.status === "dry_run_ok";

  return (
    <div className="space-y-6">
      {notice && (
        <p
          role="status"
          className={cn(
            "rounded-lg border px-3 py-2 text-xs",
            notice.kind === "ok"
              ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-300"
              : "border-risk/30 bg-risk/10 text-risk",
          )}
        >
          {notice.text}
        </p>
      )}

      {/* ---------------- Connections ---------------- */}
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg text-gold">Platform connections</h2>
          <button type="button" onClick={refresh} aria-label="Refresh" className="text-white/40 hover:text-white">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {platforms.map((spec) => {
            const acct = (accounts ?? []).find((a) => a.platform === spec.platform);
            const open = connectOpen === spec.platform;
            return (
              <div key={spec.platform} className="rounded-xl border border-hairline bg-ink-900/40 p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">
                      {spec.label}
                      {acct?.handle ? <span className="ms-2 text-xs font-normal text-white/45">{acct.handle}</span> : null}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-white/40">
                      {acct?.status_detail ??
                        (spec.nativePublish ? "Native publishing ready — connect to activate." : "Registers now; publishing activates when the adapter ships.")}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                      acct?.status === "connected"
                        ? "bg-emerald-500/15 text-emerald-300"
                        : acct?.status === "error"
                          ? "bg-risk/15 text-risk"
                          : "bg-white/10 text-white/50",
                    )}
                  >
                    {acct?.status === "connected" ? <CheckCircle2 className="h-3 w-3" /> : acct?.status === "error" ? <XCircle className="h-3 w-3" /> : <CircleSlash className="h-3 w-3" />}
                    {acct?.status ?? "not set up"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setConnectOpen(open ? null : spec.platform);
                    setCHandle(acct?.handle ?? "");
                    setCExternalId(acct?.external_account_id ?? "");
                    setCToken("");
                  }}
                  className="mt-2 inline-flex items-center gap-1.5 text-xs text-gold hover:underline"
                  aria-expanded={open}
                >
                  <PlugZap className="h-3.5 w-3.5" /> {acct?.has_token ? "Reconnect / update token" : "Connect"}
                  <ChevronDown className={cn("h-3 w-3 transition", open && "rotate-180")} />
                </button>
                {open && (
                  <div className="mt-3 space-y-2 border-t border-hairline pt-3">
                    <ul className="ms-4 list-disc space-y-0.5 text-[11px] text-white/45">
                      {spec.connectRequirements.map((r) => (
                        <li key={r}>{r}</li>
                      ))}
                    </ul>
                    <label className="block">
                      <span className={LABEL}>Handle</span>
                      <input className={FIELD} value={cHandle} onChange={(e) => setCHandle(e.target.value)} placeholder="@alwalaa.om" />
                    </label>
                    <label className="block">
                      <span className={LABEL}>Account / Page ID</span>
                      <input className={FIELD} value={cExternalId} onChange={(e) => setCExternalId(e.target.value)} />
                    </label>
                    <label className="block">
                      <span className={LABEL}>Access token (write-only — never shown again)</span>
                      <input type="password" className={FIELD} value={cToken} onChange={(e) => setCToken(e.target.value)} autoComplete="off" />
                    </label>
                    <button
                      type="button"
                      disabled={!cHandle || busy}
                      onClick={() => connect(spec.platform)}
                      className="inline-flex items-center gap-1.5 rounded-md bg-gold px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-gold-soft disabled:opacity-40"
                    >
                      <ShieldCheck className="h-3.5 w-3.5" /> {busy ? "Verifying…" : "Save & verify"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* ---------------- Composer ---------------- */}
      <Card>
        <h2 className="mb-3 text-lg text-gold">Compose</h2>
        {connected.length === 0 ? (
          <p className="text-sm text-white/45">Connect at least one platform above to compose posts.</p>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="block">
                <span className={LABEL}>Account</span>
                <select className={FIELD} value={pAccount} onChange={(e) => { setPAccount(e.target.value); setDraftId(null); setDryRunInfo(null); }}>
                  <option value="">Choose…</option>
                  {connected.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.platform} · {a.handle}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block sm:col-span-2">
                <span className={LABEL}>Link (optional)</span>
                <input className={FIELD} value={pLink} onChange={(e) => setPLink(e.target.value)} placeholder="https://…" />
              </label>
            </div>
            <label className="block">
              <span className={LABEL}>Caption ({pBody.length} chars)</span>
              <textarea className={cn(FIELD, "h-28")} value={pBody} onChange={(e) => { setPBody(e.target.value); setDryRunInfo(null); }} />
            </label>
            <div>
              <span className={LABEL}>Media (approved library only) — {pMedia.length} selected</span>
              {media.length === 0 ? (
                <p className="text-[11px] text-white/40">
                  No approved public-licensed media yet — approve images in Hero &amp; Media first.
                </p>
              ) : (
                <div className="grid max-h-40 grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-8">
                  {media.map((m) => {
                    const on = pMedia.includes(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        aria-pressed={on}
                        title={m.alt_text ?? m.filename}
                        onClick={() => { setPMedia(on ? pMedia.filter((x) => x !== m.id) : [...pMedia, m.id]); setDryRunInfo(null); }}
                        className={cn(
                          "relative overflow-hidden rounded-lg border",
                          on ? "border-gold ring-1 ring-gold/60" : "border-hairline",
                        )}
                      >
                        {m.preview_url ? (
                          <img src={m.preview_url} alt={m.alt_text ?? ""} className="h-14 w-full object-cover" />
                        ) : (
                          <span className="grid h-14 place-items-center text-[9px] text-white/40">no preview</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            {dryRunInfo && (
              <p className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
                {dryRunInfo}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={!pAccount || busy}
                onClick={saveDraft}
                className="rounded-md border border-hairline px-4 py-2 text-sm text-white/70 transition hover:border-gold/40 hover:text-white disabled:opacity-40"
              >
                Save draft
              </button>
              <button
                type="button"
                disabled={!pAccount || busy}
                onClick={dryRun}
                className="inline-flex items-center gap-1.5 rounded-md border border-gold/40 bg-gold/10 px-4 py-2 text-sm font-semibold text-gold transition hover:bg-gold/20 disabled:opacity-40"
              >
                <ShieldCheck className="h-4 w-4" /> Dry run
              </button>
              <button
                type="button"
                disabled={!canGoLive || busy}
                onClick={publishLive}
                title={canGoLive ? "Publish for real" : "A successful dry run is required first"}
                className="inline-flex items-center gap-1.5 rounded-md bg-gold px-4 py-2 text-sm font-semibold text-ink transition hover:bg-gold-soft disabled:opacity-40"
              >
                <Send className="h-4 w-4" /> Publish
              </button>
              <span className="text-[11px] text-white/35">Publish unlocks only after a passed dry run.</span>
            </div>
          </div>
        )}
      </Card>

      {/* ---------------- History ---------------- */}
      <Card>
        <h2 className="mb-3 text-lg text-gold">Post history</h2>
        {!posts || posts.length === 0 ? (
          <p className="text-sm text-white/45">Nothing yet.</p>
        ) : (
          <ul className="space-y-2">
            {posts.map((p) => (
              <li key={p.id} className="flex items-center gap-3 rounded-lg border border-hairline bg-ink-900/40 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-white/85">{p.body || "(no caption)"}</p>
                  <p className="mt-0.5 text-[11px] text-white/40">
                    {p.social_accounts ? `${p.social_accounts.platform} · ${p.social_accounts.handle}` : "—"} ·{" "}
                    {p.media_file_ids.length} image(s)
                    {p.link_url ? <> · <Link2 className="inline h-3 w-3" /> link</> : null}
                    {p.posted_at ? ` · posted ${p.posted_at.slice(0, 16).replace("T", " ")}` : ""}
                    {p.error ? ` · ${p.error.slice(0, 80)}` : ""}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                    p.status === "posted"
                      ? "bg-emerald-500/15 text-emerald-300"
                      : p.status === "failed"
                        ? "bg-risk/15 text-risk"
                        : p.status === "dry_run_ok"
                          ? "bg-gold/15 text-gold"
                          : "bg-white/10 text-white/50",
                  )}
                >
                  {p.status.replace(/_/g, " ")}
                </span>
                {p.status !== "posted" && (
                  <button
                    type="button"
                    onClick={() => {
                      setDraftId(p.id);
                      setPAccount(p.account_id);
                      setPBody(p.body);
                      setPLink(p.link_url ?? "");
                      setPMedia(p.media_file_ids);
                      setDryRunInfo(null);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="shrink-0 text-xs text-gold hover:underline"
                  >
                    Edit
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
