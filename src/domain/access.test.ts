import { describe, it, expect } from "vitest";
import { dataScope, canManageSettings, canSeeAllData, canAccessOwned } from "./access";

describe("role-based access", () => {
  it("maps roles to data scope", () => {
    expect(dataScope("CEO")).toBe("ALL");
    expect(dataScope("SALES_HEAD")).toBe("TEAM");
    expect(dataScope("FINANCE")).toBe("TEAM");
    expect(dataScope("ADVISOR")).toBe("OWN");
    expect(dataScope(null)).toBe("OWN");
  });

  it("gates settings + all-data visibility", () => {
    expect(canManageSettings("SALES_HEAD")).toBe(true);
    expect(canManageSettings("ADVISOR")).toBe(false);
    expect(canSeeAllData("FINANCE")).toBe(true);
    expect(canSeeAllData("ADVISOR")).toBe(false);
  });

  it("enforces owned-record access for agents", () => {
    expect(canAccessOwned("ADVISOR", "a1", "a1")).toBe(true);
    expect(canAccessOwned("ADVISOR", "a1", "a2")).toBe(false);
    expect(canAccessOwned("CEO", "a1", "a2")).toBe(true);
  });
});
