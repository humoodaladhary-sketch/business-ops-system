"use client";

import { useRef, useState } from "react";
import { Send, Loader2, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

export function Copilot({ department, starters }: { department: string; starters: string[] }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [setup, setSetup] = useState<boolean>(false);
  const [err, setErr] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    setErr(null);
    const next: Msg[] = [...messages, { role: "user", content: q }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const r = await fetch("/api/copilot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ department, messages: next }),
      });
      const j = await r.json();
      if (j.setup) {
        setSetup(true);
      } else if (j.error) {
        setErr(j.detail ? `${j.error}: ${j.detail}` : j.error);
      } else {
        setMessages((m) => [...m, { role: "assistant", content: j.reply }]);
      }
    } catch {
      setErr("Network error — please retry.");
    } finally {
      setBusy(false);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }

  if (setup) {
    return (
      <div className="rounded-xl border border-gold/30 bg-gold/5 p-5 text-sm">
        <div className="mb-2 font-semibold text-gold">Turn on the AI chat — one time</div>
        <p className="mb-3 text-white/70">
          The live data above is already working. The chat just needs an Anthropic key, added <b>once</b>:
        </p>
        <ol className="ml-4 list-decimal space-y-1.5 text-white/80">
          <li>Get a key at <span className="text-gold">console.anthropic.com → API keys</span></li>
          <li>Vercel → this project → <span className="text-gold">Settings → Environment Variables</span></li>
          <li>Add <code className="text-gold">ANTHROPIC_API_KEY</code> = your key, then <span className="text-gold">Redeploy</span></li>
        </ol>
        <p className="mt-3 text-xs text-white/45">
          Prefer zero keys? This can also run through your existing n8n Anthropic connection — just ask.
        </p>
        <button onClick={() => setSetup(false)} className="mt-4 rounded-md border border-hairline px-3 py-1.5 text-white/70 hover:text-gold">Done — retry</button>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-16rem)] min-h-[420px] flex-col rounded-xl border border-hairline bg-ink-100/50">
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="space-y-3 pt-4 text-center">
            <Sparkles className="mx-auto h-6 w-6 text-gold/70" />
            <p className="text-sm text-white/45">Ask this department&apos;s copilot anything. It reads your live data.</p>
            <div className="mx-auto flex max-w-lg flex-wrap justify-center gap-2 pt-2">
              {starters.map((s) => (
                <button key={s} onClick={() => send(s)} className="rounded-full border border-hairline px-3 py-1.5 text-xs text-white/70 hover:border-gold/40 hover:text-gold">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            {m.role === "user" ? (
              <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-gold px-4 py-2.5 text-sm text-ink">
                {m.content}
              </div>
            ) : (
              <div className="max-w-[92%] rounded-2xl border border-hairline bg-ink-900/50 px-4 py-3 text-sm text-white/85">
                <AgentMarkdown>{m.content}</AgentMarkdown>
              </div>
            )}
          </div>
        ))}
        {busy && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-2xl border border-hairline bg-ink-900/50 px-4 py-2.5 text-sm text-white/50">
              <Loader2 className="h-4 w-4 animate-spin" /> thinking…
            </div>
          </div>
        )}
        {err && <p className="rounded-md border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-300">{err}</p>}
        <div ref={endRef} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex gap-2 border-t border-hairline p-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Message the copilot…"
          className="flex-1 rounded-md border border-hairline bg-ink-100 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-gold/50 focus:outline-none"
        />
        <button disabled={busy || !input.trim()} className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-gold text-ink hover:bg-gold-soft disabled:opacity-50">
          <Send className="h-4 w-4" />
        </button>
      </form>
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
