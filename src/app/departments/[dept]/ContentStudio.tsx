"use client";

import { useState } from "react";
import { Check, Clipboard, Loader2, Save, Wand2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ITC_PROJECTS } from "../../_data/itc-zones";

const PLATFORMS = ["Instagram", "TikTok", "YouTube", "LinkedIn", "WhatsApp"] as const;
const CONTENT_TYPES = ["Reel script", "Carousel", "Caption + hashtags", "Post", "Hook pack"] as const;

// A few ITC (all-nationalities) project names as quick topic chips, plus evergreen angles.
const TOPIC_CHIPS = [
  ...ITC_PROJECTS.filter((p) => p.category === "ITC")
    .slice(0, 4)
    .map((p) => p.name),
  "Golden Residency",
  "Why Oman ITC",
  "Market update",
];

interface Msg {
  role: "user" | "assistant";
  content: string;
}

export function ContentStudio({}: {}) {
  const [platform, setPlatform] = useState<string>("Instagram");
  const [ctype, setCtype] = useState<string>("Reel script");
  const [topic, setTopic] = useState("");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [lastPrompt, setLastPrompt] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function callCopilot(messages: Msg[]): Promise<string | null> {
    const r = await fetch("/api/copilot", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ department: "marketing", messages }),
    });
    const j = await r.json();
    if (j.setup) {
      setErr("The copilot needs its Anthropic key first — see the Copilot section below.");
      return null;
    }
    if (j.error) {
      setErr(j.detail ? `${j.error}: ${j.detail}` : j.error);
      return null;
    }
    return j.reply as string;
  }

  async function generate() {
    const t = topic.trim();
    if (!t || busy || saving) return;
    setErr(null);
    setResult(null);
    setSavedNote(null);
    setCopied(false);
    setBusy(true);
    const prompt = `Create a ${ctype} for ${platform} about: ${t}. Use your live tools for any figures. Return the complete pack (hook, body/script, caption, hashtags, CTA) ready to publish. After the pack, do not ask questions.`;
    try {
      const reply = await callCopilot([{ role: "user", content: prompt }]);
      if (reply) {
        setResult(reply);
        setLastPrompt(prompt);
      }
    } catch {
      setErr("Network error — please retry.");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setErr("Couldn't copy — your browser blocked clipboard access.");
    }
  }

  async function saveToLibrary() {
    if (!result || !lastPrompt || saving || busy) return;
    setErr(null);
    setSaving(true);
    const followUp = `Save this exact draft to the content library with save_content_draft. Platform: ${platform}. Title: ${ctype}: ${topic.trim()}.`;
    try {
      const reply = await callCopilot([
        { role: "user", content: lastPrompt },
        { role: "assistant", content: result },
        { role: "user", content: followUp },
      ]);
      if (reply) setSavedNote(reply);
    } catch {
      setErr("Network error — please retry.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-hairline bg-ink-100/50 p-4 sm:p-5">
      <div className="mb-4">
        <h2 className="font-heading text-lg text-white">Content Studio</h2>
        <p className="text-sm text-white/50">
          Generate on-brand content grounded in live data — then save it to the library.
        </p>
      </div>

      {/* Platform pills */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {PLATFORMS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPlatform(p)}
            className={
              platform === p
                ? "rounded-full border border-gold bg-gold px-3 py-1.5 text-xs font-semibold text-ink"
                : "rounded-full border border-hairline px-3 py-1.5 text-xs text-white/60 hover:border-gold/40 hover:text-gold"
            }
          >
            {p}
          </button>
        ))}
      </div>

      {/* Type + topic */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <select
          value={ctype}
          onChange={(e) => setCtype(e.target.value)}
          className="rounded-md border border-hairline bg-ink-100 px-3 py-2 text-sm text-white focus:border-gold/50 focus:outline-none sm:w-52"
        >
          {CONTENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") generate();
          }}
          placeholder="Topic — a project, an angle, a question…"
          className="flex-1 rounded-md border border-hairline bg-ink-100 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-gold/50 focus:outline-none"
        />
      </div>

      {/* Topic quick chips */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {TOPIC_CHIPS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setTopic(c)}
            className="rounded-full border border-hairline px-2.5 py-1 text-[11px] text-white/55 hover:border-gold/40 hover:text-gold"
          >
            {c}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={generate}
        disabled={busy || saving || !topic.trim()}
        className="mt-3 inline-flex items-center gap-2 rounded-md bg-gold px-4 py-2 text-sm font-semibold text-ink hover:bg-gold-soft disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
        {busy ? "Generating…" : "Generate"}
      </button>

      {err && <p className="mt-3 rounded-md border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-300">{err}</p>}

      {/* Result */}
      {result && (
        <div className="mt-4 rounded-2xl border border-hairline bg-ink-900/50 p-4 text-sm text-white/85">
          <AgentMarkdown>{result}</AgentMarkdown>
          <div className="mt-4 flex flex-wrap gap-2 border-t border-hairline pt-3">
            <button
              type="button"
              onClick={copy}
              className="inline-flex items-center gap-1.5 rounded-md border border-hairline px-3 py-1.5 text-xs text-white/70 hover:border-gold/40 hover:text-gold"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-gold" /> : <Clipboard className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
            <button
              type="button"
              onClick={saveToLibrary}
              disabled={saving || busy}
              className="inline-flex items-center gap-1.5 rounded-md border border-gold/40 px-3 py-1.5 text-xs text-gold hover:bg-gold/10 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {saving ? "Saving…" : "Save to library"}
            </button>
          </div>
          {savedNote && (
            <div className="mt-3 rounded-md border border-gold/30 bg-gold/5 p-3 text-xs text-white/80">
              <AgentMarkdown>{savedNote}</AgentMarkdown>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Renders the agent's markdown reply — tables scroll on mobile, gold-accented.
// Styled via arbitrary variants (no custom components → no node-prop pitfalls).
function AgentMarkdown({ children }: { children: string }) {
  return (
    <div
      className={
        "space-y-2 leading-relaxed " +
        "[&_p]:my-1.5 " +
        "[&_h1]:mb-1 [&_h1]:mt-2 [&_h1]:font-heading [&_h1]:text-base [&_h1]:text-white " +
        "[&_h2]:mb-1 [&_h2]:mt-2 [&_h2]:font-heading [&_h2]:text-base [&_h2]:text-white " +
        "[&_h3]:mb-1 [&_h3]:mt-2 [&_h3]:font-semibold [&_h3]:text-white " +
        "[&_ul]:my-1.5 [&_ul]:ml-4 [&_ul]:list-disc [&_ul]:space-y-1 " +
        "[&_ol]:my-1.5 [&_ol]:ml-4 [&_ol]:list-decimal [&_ol]:space-y-1 " +
        "[&_li]:marker:text-gold/60 " +
        "[&_strong]:font-semibold [&_strong]:text-white " +
        "[&_a]:text-gold [&_a]:underline " +
        "[&_code]:rounded [&_code]:bg-ink [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-gold " +
        "[&_hr]:my-3 [&_hr]:border-hairline " +
        "[&_blockquote]:border-l-2 [&_blockquote]:border-gold/40 [&_blockquote]:pl-3 [&_blockquote]:text-white/70 " +
        "[&_table]:my-2 [&_table]:block [&_table]:w-full [&_table]:overflow-x-auto [&_table]:border-collapse [&_table]:text-xs " +
        "[&_th]:whitespace-nowrap [&_th]:border [&_th]:border-hairline [&_th]:bg-ink-900/60 [&_th]:px-3 [&_th]:py-1.5 [&_th]:text-left [&_th]:text-[10px] [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-white/60 " +
        "[&_td]:border [&_td]:border-white/5 [&_td]:px-3 [&_td]:py-1.5 [&_td]:align-top [&_td]:text-white/85"
      }
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
