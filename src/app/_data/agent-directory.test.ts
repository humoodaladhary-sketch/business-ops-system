import { describe, expect, it } from "vitest";
import { AGENTS } from "./dataset";
import { AGENT_DIRECTORY, AGENT_NAME_BY_ID } from "./agent-directory";

// AGENT_DIRECTORY is duplicated rather than derived, so that client components
// can import it without dragging `dataset` — and its customer PII — into the
// browser bundle. The cost of that duplication is drift, which this catches.
describe("AGENT_DIRECTORY mirrors AGENTS", () => {
  it("has the same agents, in the same order, with the same names", () => {
    expect(AGENT_DIRECTORY).toEqual(AGENTS.map((a) => ({ id: a.id, name: a.name })));
  });

  it("exposes nothing beyond id and name", () => {
    for (const entry of AGENT_DIRECTORY) {
      expect(Object.keys(entry).sort()).toEqual(["id", "name"]);
    }
  });

  it("indexes every agent by id", () => {
    expect(AGENT_NAME_BY_ID.size).toBe(AGENTS.length);
    for (const a of AGENTS) expect(AGENT_NAME_BY_ID.get(a.id)).toBe(a.name);
  });
});
