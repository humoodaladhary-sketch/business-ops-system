// The advisor roster reduced to what a browser is allowed to know: an id and a
// display name, for labelling rows and filling filter dropdowns.
//
// Why this is a separate file rather than a slice of `dataset.ts`: importing
// AGENTS from `dataset` in a "use client" component pulls the whole module into
// the client bundle, and `dataset` also holds LEADS and DEALS — real client
// names, emails and phone numbers. That is not theoretical; the shipped bundle
// was verified to contain live customer contact details. `dataset` runs helper
// calls at module scope, so the bundler cannot tree-shake the unused exports
// away.
//
// This module is a plain literal with no imports, so it carries nothing else in
// with it. It also deliberately omits the per-agent targets and Drive folder ids
// that AGENTS holds — the client has no use for either.
//
// `agent-directory.test.ts` asserts this stays in step with AGENTS.

export interface AgentDirectoryEntry {
  id: string;
  name: string;
}

export const AGENT_DIRECTORY: AgentDirectoryEntry[] = [
  { id: "shatha", name: "Shatha Al Manthari" },
  { id: "yousef", name: "Yousef" },
  { id: "alex", name: "Alex Showran" },
  { id: "pasha", name: "Pasha" },
  { id: "wesam", name: "Wesam Zeno" },
  { id: "khalid", name: "Khalid" },
  { id: "tariq", name: "Tariq" },
  { id: "abeer", name: "Abeer Al Wardi" },
];

/** id → display name, for the common labelling case. */
export const AGENT_NAME_BY_ID = new Map(AGENT_DIRECTORY.map((a) => [a.id, a.name]));
