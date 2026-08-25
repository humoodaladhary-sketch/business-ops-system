// A production incident, encoded as a rule.
//
// The CEO dataset is read with literal paths (see ceoData.ts), which the build's
// file tracer resolves on its own. An earlier attempt instead declared
// `outputFileTracingIncludes: { "/api/copilot": ["./data/ceo/**"] }`. That glob
// traced the whole repository root — including `.git` and the build output —
// into every serverless function, took the largest one from 17 MB to 442 MB and
// failed the Vercel deploy against its 250 MB limit.
//
// This test exists so that never comes back quietly.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const config = () => readFileSync(join(process.cwd(), "next.config.mjs"), "utf8");

describe("next.config.mjs file tracing", () => {
  it("declares no output file tracing includes — literal read paths handle it", () => {
    expect(config()).not.toMatch(/outputFileTracingIncludes/);
  });

  it("contains no recursive glob that could sweep the repository root", () => {
    // Catches "./data/ceo/**", "./**", "src/**" and friends anywhere in the config.
    expect(config()).not.toMatch(/["'][^"']*\/\*\*["']/);
  });
});
