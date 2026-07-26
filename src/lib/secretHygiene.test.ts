// Secret hygiene — this repo is PUBLIC, so a hardcoded token or password
// fallback is a published credential. These rules pin the July 2026 cleanup
// (hardcoded x-sync-token + login password fallbacks) so it cannot recur.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOTS = ["src", "supabase/functions"];
const EXT = /\.(ts|tsx|js|mjs)$/;

function* walk(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (EXT.test(name) && !name.endsWith(".test.ts")) yield p;
  }
}

const files = ROOTS.flatMap((r) => [...walk(r)]).map((p) => ({ path: p, text: readFileSync(p, "utf8") }));

describe("secret hygiene (public repo)", () => {
  it("scans a sane number of source files", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it("has no long hex literals (leaked tokens) in source", () => {
    const offenders = files.filter((f) => /["'`][0-9a-f]{32,}["'`]/i.test(f.text)).map((f) => f.path);
    expect(offenders).toEqual([]);
  });

  it("never falls back from a secret env var to a string literal", () => {
    // process.env.X_TOKEN || "..."   /   Deno.env.get("X_TOKEN") ?? "..."
    const pattern =
      /(?:process\.env\.\w*(?:TOKEN|PASSWORD|SECRET|KEY)\w*|Deno\.env\.get\(["']\w*(?:TOKEN|PASSWORD|SECRET|KEY)\w*["']\))\s*(?:\|\||\?\?)\s*["'`][^"'`\s]+["'`]/;
    const offenders = files.filter((f) => pattern.test(f.text)).map((f) => f.path);
    expect(offenders).toEqual([]);
  });
});
