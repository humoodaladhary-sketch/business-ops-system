import { describe, it, expect } from "vitest";
import { decideIngest } from "./dedup";

describe("decideIngest (dedup-on-ingest)", () => {
  it("attaches a touch when an open lead exists", () => {
    expect(decideIngest([{ id: "l1", clientId: "c1", stage: "ENGAGED" }])).toEqual({
      action: "ATTACH_TOUCH",
      leadId: "l1",
      clientId: "c1",
    });
  });

  it("creates a new lead on the SAME client when only closed leads exist", () => {
    expect(decideIngest([{ id: "l1", clientId: "c1", stage: "CLOSED_LOST" }])).toEqual({
      action: "NEW_LEAD",
      clientId: "c1",
    });
  });

  it("creates a brand-new lead + client when there's no prior lead", () => {
    expect(decideIngest([])).toEqual({ action: "NEW_LEAD", clientId: null });
  });

  it("prefers the open lead even if a closed one also exists", () => {
    const d = decideIngest([
      { id: "old", clientId: "c1", stage: "CLOSED_WON" },
      { id: "live", clientId: "c1", stage: "NEW" },
    ]);
    expect(d).toEqual({ action: "ATTACH_TOUCH", leadId: "live", clientId: "c1" });
  });
});
