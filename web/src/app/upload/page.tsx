"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Stage = "idle" | "uploading" | "extracting" | "done" | "error";

export default function UploadPage() {
  const router = useRouter();
  const [projectName, setProjectName] = useState("");
  const [developer, setDeveloper] = useState("");
  const [zone, setZone] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [stage, setStage] = useState<Stage>("idle");
  const [message, setMessage] = useState<string | null>(null);

  function onFiles(selected: FileList | null) {
    if (!selected) return;
    setFiles(Array.from(selected));
  }

  async function submit() {
    try {
      setStage("uploading");
      setMessage("Reading files…");

      const fd = new FormData();
      fd.append("project_name", projectName);
      fd.append("developer", developer);
      fd.append("zone", zone);
      for (const f of files) fd.append("files", f);

      setStage("extracting");
      setMessage("Claude is analyzing every file and extracting units. This can take 30–90 seconds…");

      const resp = await fetch("/api/extract", { method: "POST", body: fd });
      const body = await resp.json();

      if (!resp.ok) throw new Error(body.error ?? "Extraction failed");

      setStage("done");
      setMessage(`Extracted ${body.unit_count ?? 0} units. Redirecting…`);
      setTimeout(() => router.push("/inventory"), 1200);
    } catch (err) {
      setStage("error");
      setMessage((err as Error).message);
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-3xl">New project</h1>
        <p className="text-sm text-[var(--color-brand-gray-500)] mt-1">
          Drop any combination of Excel inventory, brochures, renders, floor plans, and payment plans.
          The AI figures out which file is which.
        </p>
      </header>

      <section className="card p-6 space-y-4">
        <h2 className="font-display text-xl">1. Project details</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Project name" value={projectName} onChange={setProjectName} placeholder="Sultan Haitham City — Phase 1" />
          <Field label="Developer" value={developer} onChange={setDeveloper} placeholder="Omani Diwan of Royal Court" />
          <Field label="Zone" value={zone} onChange={setZone} placeholder="SHC-A" />
        </div>
      </section>

      <section className="card p-6 space-y-4">
        <h2 className="font-display text-xl">2. Upload files</h2>
        <label className="block border-2 border-dashed border-[var(--color-brand-gray-200)]
                         rounded-sm p-10 text-center cursor-pointer hover:border-[var(--color-brand-gold)]
                         transition bg-[var(--color-brand-ivory)]">
          <input
            type="file"
            multiple
            className="hidden"
            accept=".xlsx,.xls,.csv,.pdf,.jpg,.jpeg,.png,.webp"
            onChange={(e) => onFiles(e.target.files)}
          />
          <div className="text-sm text-[var(--color-brand-gray-500)]">
            Click to choose files or drag and drop here
          </div>
          <div className="text-xs text-[var(--color-brand-gray-500)] mt-1">
            Excel · PDF · PNG / JPG / WebP
          </div>
        </label>

        {files.length > 0 && (
          <ul className="text-sm space-y-1">
            {files.map((f) => (
              <li key={f.name} className="flex justify-between">
                <span>📄 {f.name}</span>
                <span className="text-[var(--color-brand-gray-500)]">{(f.size / 1024).toFixed(1)} KB</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex items-center gap-4">
        <button className="btn-gold" onClick={submit} disabled={files.length === 0 || stage === "extracting"}>
          {stage === "extracting" ? "Extracting…" : "⚙ Extract units"}
        </button>
        {message && (
          <span className={stage === "error" ? "text-red-700 text-sm" : "text-sm text-[var(--color-brand-gray-500)]"}>
            {message}
          </span>
        )}
      </div>

    </div>
  );
}

function Field({
  label, value, onChange, placeholder,
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wider text-[var(--color-brand-gray-500)]">{label}</span>
      <input
        className="mt-1 w-full border border-[var(--color-brand-gray-200)] rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-brand-black)]"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}
