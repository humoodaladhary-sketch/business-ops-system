// The dataset is read at request time, not baked in. This is what makes the
// copilot "live": when the source data changes, the next answer changes.
import { afterEach, describe, expect, it } from "vitest";
import { copyFileSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { CEO_DATA_TTL_MS, clearCeoDatasetCache, loadCeoDataset, todayInMuscat } from "./ceoData";

const SETTINGS = join(process.cwd(), "data", "ceo", "settings.json");
const BACKUP = join(process.cwd(), "data", "ceo", ".settings.backup.json");

afterEach(() => {
  try {
    copyFileSync(BACKUP, SETTINGS);
    rmSync(BACKUP);
  } catch {
    /* no backup taken by this test */
  }
  clearCeoDatasetCache();
});

describe("loading the dataset", () => {
  it("loads the shipped 12 people and 38 deals", () => {
    clearCeoDatasetCache();
    const ds = loadCeoDataset();
    expect(ds.people).toHaveLength(12);
    expect(ds.deals).toHaveLength(38);
    expect(ds.costPolicies).toHaveLength(2);
  });

  it("reuses the parsed dataset inside the cache window", () => {
    clearCeoDatasetCache();
    const first = loadCeoDataset({ now: 1_000 });
    const second = loadCeoDataset({ now: 1_000 + CEO_DATA_TTL_MS - 1 });
    expect(second).toBe(first);
  });

  it("picks up an edit to the source data — the answer is not baked in", () => {
    clearCeoDatasetCache();
    copyFileSync(SETTINGS, BACKUP);

    const before = loadCeoDataset({ now: 0 });
    expect(before.settings.advisorMonthlyTargetBaisa).toBe(250_000_000);

    const edited = JSON.parse(readFileSync(SETTINGS, "utf8"));
    edited.advisorMonthlyTargetOmr = "300000.000";
    writeFileSync(SETTINGS, JSON.stringify(edited, null, 2));

    // Past the cache window, the new figure is read without a restart or a deploy.
    const after = loadCeoDataset({ now: CEO_DATA_TTL_MS + 1 });
    expect(after.settings.advisorMonthlyTargetBaisa).toBe(300_000_000);
    expect(after).not.toBe(before);
  });

  it("re-reads without re-parsing when the files have not changed", () => {
    clearCeoDatasetCache();
    const first = loadCeoDataset({ now: 0 });
    const later = loadCeoDataset({ now: CEO_DATA_TTL_MS + 1 });
    // Same content, so the same parsed object is kept rather than rebuilt.
    expect(later).toBe(first);
  });

  it("forces a re-read when asked", () => {
    clearCeoDatasetCache();
    const first = loadCeoDataset({ now: 0 });
    expect(loadCeoDataset({ force: true, now: 0 })).toBe(first);
  });
});

describe("the working day", () => {
  it("reports today in Asia/Muscat, not UTC", () => {
    // 22:00 UTC is already the next day in Muscat (UTC+4).
    expect(todayInMuscat(new Date("2026-08-25T22:00:00Z"))).toBe("2026-08-26");
    expect(todayInMuscat(new Date("2026-08-25T10:00:00Z"))).toBe("2026-08-25");
  });
});
