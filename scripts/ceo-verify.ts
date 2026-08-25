// Prints the verified table straight out of the calc layer.
//
//   npm run ceo:verify
//
// Every figure below is computed from data/ceo/deals-2026.csv and the seed
// files — nothing is transcribed. Run it to see the maths reproduce the CEO's
// published table, and to see it move when the seed data moves.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  baisaToOmr,
  breakEvenVolume,
  companyKeepRate,
  companySummary,
  contribution,
  effectiveCommissionRate,
  formatOmr,
  loadDataset,
  openReferralLiabilities,
  paybackMonth,
  runRateFixedCost,
  tenureMonths,
  trend,
  wageRebasingScenario,
} from "@/lib/calc";
import type { MonthWindow } from "@/lib/calc";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (name: string) => readFileSync(join(ROOT, "data", "ceo", name), "utf8");

const AS_OF = process.argv[2] ?? "2026-08-25";
const WINDOW: MonthWindow = { from: "2026-01", to: AS_OF.slice(0, 7) };

const dataset = loadDataset({
  peopleJson: JSON.parse(read("people.json")),
  costPoliciesJson: JSON.parse(read("cost-policies.json")),
  settingsJson: JSON.parse(read("settings.json")),
  provisionsJson: JSON.parse(read("provisions.json")),
  dealsCsv: read("deals-2026.csv"),
});

const { people, deals, costPolicies } = dataset;
const omr0 = (b: number) => formatOmr(b, { decimals: 0 });
const pad = (s: string, w: number) => s.padStart(w);
const padEnd = (s: string, w: number) => s.padEnd(w);

console.log(`\nCEO COMMAND CENTER — verified figures as of ${AS_OF}`);
console.log(`Measured from ${WINDOW.from} (Khalid and Suleiman from 2026-06)\n`);

const COLS: [string, number][] = [
  ["Person", 12], ["Months", 7], ["Deals", 7], ["Volume", 12],
  ["Brought in", 12], ["Cost", 9], ["Net", 11], ["Return", 9], ["Trend", 14],
];
console.log(COLS.map(([h, w], i) => (i === 0 ? padEnd(h, w) : pad(h, w))).join(""));
console.log("─".repeat(COLS.reduce((s, [, w]) => s + w, 0)));

for (const person of people) {
  const c = contribution(person, deals, WINDOW, costPolicies);
  if (c.months === 0) continue;
  const t = c.revenueScored ? trend(person, deals, AS_OF, costPolicies).direction : "KPI-scored";
  const row = [
    padEnd(person.name.en.split(" ")[0], 12),
    pad(String(tenureMonths(person, AS_OF)), 7),
    pad(c.deals ? String(c.deals.count) : "—", 7),
    pad(c.deals ? omr0(c.deals.volumeBaisa) : "—", 12),
    pad(c.broughtInBaisa === null ? "—" : omr0(c.broughtInBaisa), 12),
    pad(omr0(c.costBaisa), 9),
    pad(c.netBaisa === null ? "—" : (c.netBaisa >= 0 ? "+" : "") + omr0(c.netBaisa), 11),
    pad(c.returnMultiple === null ? "—" : `${c.returnMultiple.toFixed(1)}x`, 9),
    pad(t === "not-measurable" ? "—" : t, 14),
  ].join("");
  console.log(row);
}

const summary = companySummary(people, deals, WINDOW, costPolicies);
console.log("─".repeat(COLS.reduce((s, [, w]) => s + w, 0)));
console.log(
  [
    padEnd("COMPANY", 12), pad("", 7),
    pad(String(summary.deals.count), 7),
    pad(omr0(summary.deals.volumeBaisa), 12),
    pad(omr0(summary.deals.companyNetBaisa), 12),
    pad(omr0(summary.totalCostBaisa), 9),
    pad((summary.netBaisa >= 0 ? "+" : "") + omr0(summary.netBaisa), 11),
    pad(`${summary.returnMultiple!.toFixed(1)}x`, 9),
  ].join(""),
);

const keepRate = companyKeepRate(deals);
const before = runRateFixedCost(people, AS_OF, "2026-08", costPolicies);
const after = runRateFixedCost(people, AS_OF, "2026-09", costPolicies);
const scenario = wageRebasingScenario(people, "2026-09", costPolicies);

console.log(`\nDERIVED RATES (computed from the ${summary.deals.count} deals, not hardcoded)`);
console.log(`  Effective commission rate   ${(effectiveCommissionRate(deals)! * 100).toFixed(4)}% of volume`);
console.log(`  Company keep rate           ${(keepRate! * 100).toFixed(4)}% of volume`);

console.log(`\nCOST POLICY (${before.activeHeadcount} active people, ${people.length} seeded)`);
for (const [label, fc] of [["Jan–Aug 2026 ", before], ["From Sep 2026", after]] as const) {
  const be = breakEvenVolume(fc.totalBaisa, keepRate);
  console.log(
    `  ${label}  payroll ${pad(formatOmr(fc.payrollBaisa, { decimals: 2 }), 9)}` +
      `   fixed ${pad(formatOmr(fc.totalBaisa, { decimals: 2 }), 9)}` +
      `   break-even ${pad(omr0(be!), 9)} OMR/month`,
  );
}
console.log(`  Change from September       +${formatOmr(after.payrollBaisa - before.payrollBaisa, { decimals: 2 })} OMR/month`);
console.log(`  Unpriced cost items         ${after.unpricedCostItems} — a visible gap, not zero`);

console.log(`\nPAYBACK`);
for (const person of people) {
  const month = paybackMonth(person, deals, AS_OF, costPolicies);
  if (!contribution(person, deals, WINDOW, costPolicies).revenueScored) continue;
  console.log(`  ${padEnd(person.name.en.split(" ")[0], 12)} ${month ?? "not yet"}`);
}

console.log(`\nOPEN LIABILITIES AND RISKS`);
for (const l of openReferralLiabilities(deals)) {
  console.log(`  Referral owed to ${padEnd(l.payee, 12)} ${pad(formatOmr(l.amountBaisa, { decimals: 2 }), 10)} OMR  (${l.dealRefs.join(", ")})`);
}
for (const p of dataset.provisions) {
  console.log(`  ${p.label.en}`);
  console.log(`      ${p.amountBaisa === null ? p.flag.en : `${formatOmr(p.amountBaisa)} OMR`}`);
}
console.log(
  `  Wage re-basing scenario (not booked)  ` +
    `+${formatOmr(scenario.monthlyDeltaBaisa, { decimals: 2 })} OMR/month, ` +
    `~${Math.round(baisaToOmr(scenario.annualDeltaBaisa)).toLocaleString("en-US")} OMR/year`,
);
console.log();
