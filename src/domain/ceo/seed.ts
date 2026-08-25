// Loading the seed data files into a validated dataset.
//
// The seed files hold money as decimal OMR strings, so no float exists anywhere
// in the pipeline — not in the sheet, not in the seed, not in the maths. This
// module is the only place that converts, and it validates as it goes: a
// malformed seed fails loudly at load rather than quietly at a screen.
//
// Pure and I/O-free. Callers read the files (Node, an API route, a test) and
// hand the text in.

import { type Baisa, omrStringToBaisa } from "./baisa";
import { parseIsoDate } from "./calendar";
import { importDealsCsv } from "./csv";
import type {
  BonusBand,
  CeoDataset,
  CompanySettings,
  CostPolicy,
  Deal,
  OverheadLine,
  Person,
  PersonClass,
  PayrollClass,
  Provision,
} from "./types";

export class SeedError extends Error {}

type Json = Record<string, unknown>;

function obj(value: unknown, where: string): Json {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new SeedError(`${where}: expected an object.`);
  }
  return value as Json;
}

function arr(value: unknown, where: string): unknown[] {
  if (!Array.isArray(value)) throw new SeedError(`${where}: expected an array.`);
  return value;
}

function str(value: unknown, where: string): string {
  if (typeof value !== "string") throw new SeedError(`${where}: expected a string.`);
  return value;
}

function num(value: unknown, where: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new SeedError(`${where}: expected a finite number.`);
  }
  return value;
}

function money(value: unknown, where: string): Baisa {
  return omrStringToBaisa(str(value, where));
}

function moneyOrNull(value: unknown, where: string): Baisa | null {
  return value === null ? null : money(value, where);
}

function date(value: unknown, where: string): string {
  const s = str(value, where);
  parseIsoDate(s);
  return s;
}

function dateOrNull(value: unknown, where: string): string | null {
  return value === null ? null : date(value, where);
}

function bilingual(value: unknown, where: string) {
  const o = obj(value, where);
  return { en: str(o.en, `${where}.en`), ar: str(o.ar, `${where}.ar`) };
}

const PERSON_CLASSES: readonly PersonClass[] = [
  "Owner", "Advisor", "Inventory", "LeadEngine", "Marketing", "Finance", "Contractor",
];
const PAYROLL_CLASSES: readonly PayrollClass[] = [
  "OmaniEmployee", "ExpatEmployee", "Contractor", "Unclassified",
];

function oneOf<T extends string>(value: unknown, allowed: readonly T[], where: string): T {
  const s = str(value, where);
  if (!(allowed as readonly string[]).includes(s)) {
    throw new SeedError(`${where}: ${JSON.stringify(s)} is not one of ${allowed.join(", ")}.`);
  }
  return s as T;
}

export interface PeopleSeed {
  people: Person[];
  /** Every alias and name mapped to a person id, for the CSV importer. */
  advisorIdByName: Record<string, string>;
}

export function loadPeople(json: unknown): PeopleSeed {
  const root = obj(json, "people.json");
  const people: Person[] = [];
  const advisorIdByName: Record<string, string> = {};
  const ids = new Set<string>();

  for (const [i, raw] of arr(root.people, "people.json.people").entries()) {
    const where = `people[${i}]`;
    const o = obj(raw, where);
    const id = str(o.id, `${where}.id`);
    if (ids.has(id)) throw new SeedError(`${where}: duplicate person id ${JSON.stringify(id)}.`);
    ids.add(id);

    const person: Person = {
      id,
      name: bilingual(o.name, `${where}.name`),
      role: bilingual(o.role, `${where}.role`),
      personClass: oneOf(o.personClass, PERSON_CLASSES, `${where}.personClass`),
      payrollClass: oneOf(o.payrollClass, PAYROLL_CLASSES, `${where}.payrollClass`),
      costTreatment: oneOf(o.costTreatment, ["operating", "ownerDistribution"] as const, `${where}.costTreatment`),
      basicBaisa: money(o.basicOmr, `${where}.basicOmr`),
      allowanceBaisa: money(o.allowanceOmr, `${where}.allowanceOmr`),
      commissionCutPct: num(o.commissionCutPct, `${where}.commissionCutPct`),
      measurementStartDate: date(o.measurementStartDate, `${where}.measurementStartDate`),
      hireDate: dateOrNull(o.hireDate, `${where}.hireDate`),
      endedAt: dateOrNull(o.endedAt, `${where}.endedAt`),
    };
    if (person.endedAt !== null && person.endedAt < person.measurementStartDate) {
      throw new SeedError(`${where}: endedAt is before measurementStartDate.`);
    }
    people.push(person);

    const names = [person.name.en, person.name.ar, ...arr(o.aliases ?? [], `${where}.aliases`).map((a, j) => str(a, `${where}.aliases[${j}]`))];
    for (const name of names) {
      const key = name.trim();
      const existing = advisorIdByName[key];
      if (existing && existing !== id) {
        throw new SeedError(`Alias ${JSON.stringify(key)} maps to both ${existing} and ${id}.`);
      }
      advisorIdByName[key] = id;
    }
  }
  if (people.length === 0) throw new SeedError("people.json: no people in the seed.");
  return { people, advisorIdByName };
}

function loadOverheads(value: unknown, where: string): OverheadLine[] {
  return arr(value, where).map((raw, i) => {
    const o = obj(raw, `${where}[${i}]`);
    return {
      id: str(o.id, `${where}[${i}].id`),
      label: bilingual(o.label, `${where}[${i}].label`),
      amountBaisa: moneyOrNull(o.amountOmr, `${where}[${i}].amountOmr`),
    };
  });
}

export function loadCostPolicies(json: unknown): CostPolicy[] {
  const root = obj(json, "cost-policies.json");
  const policies = arr(root.policies, "cost-policies.json.policies").map((raw, i) => {
    const where = `policies[${i}]`;
    const o = obj(raw, where);
    const si = o.socialInsurance;
    const eos = o.endOfService;
    return {
      id: str(o.id, `${where}.id`),
      label: bilingual(o.label, `${where}.label`),
      effectiveFrom: date(o.effectiveFrom, `${where}.effectiveFrom`),
      socialInsurance:
        si === null || si === undefined
          ? null
          : {
              ratePct: num(obj(si, `${where}.socialInsurance`).ratePct, `${where}.socialInsurance.ratePct`),
              contributoryWageCapBaisa: money(
                obj(si, `${where}.socialInsurance`).contributoryWageCapOmr,
                `${where}.socialInsurance.contributoryWageCapOmr`,
              ),
              basis: oneOf(obj(si, `${where}.socialInsurance`).basis, ["basic", "totalWage"] as const, `${where}.socialInsurance.basis`),
              appliesTo: arr(obj(si, `${where}.socialInsurance`).appliesTo, `${where}.socialInsurance.appliesTo`).map(
                (v, j) => oneOf(v, PAYROLL_CLASSES, `${where}.socialInsurance.appliesTo[${j}]`),
              ),
            },
      endOfService:
        eos === null || eos === undefined
          ? null
          : {
              divisor: num(obj(eos, `${where}.endOfService`).divisor, `${where}.endOfService.divisor`),
              basis: oneOf(obj(eos, `${where}.endOfService`).basis, ["basic", "totalWage"] as const, `${where}.endOfService.basis`),
              appliesTo: arr(obj(eos, `${where}.endOfService`).appliesTo, `${where}.endOfService.appliesTo`).map(
                (v, j) => oneOf(v, PAYROLL_CLASSES, `${where}.endOfService.appliesTo[${j}]`),
              ),
            },
      overheads: loadOverheads(o.overheads, `${where}.overheads`),
      note: o.note === undefined ? undefined : bilingual(o.note, `${where}.note`),
    } satisfies CostPolicy;
  });
  if (policies.length === 0) throw new SeedError("cost-policies.json: no policies in the seed.");
  return policies;
}

export function loadSettings(json: unknown): CompanySettings {
  const o = obj(json, "settings.json");
  const bands: BonusBand[] = arr(o.bonusBands, "settings.bonusBands").map((raw, i) => {
    const b = obj(raw, `bonusBands[${i}]`);
    return {
      id: str(b.id, `bonusBands[${i}].id`),
      label: bilingual(b.label, `bonusBands[${i}].label`),
      minVolumeBaisa: money(b.minVolumeOmr, `bonusBands[${i}].minVolumeOmr`),
      maxVolumeBaisa: moneyOrNull(b.maxVolumeOmr, `bonusBands[${i}].maxVolumeOmr`),
      bonusBaisa: money(b.bonusOmr, `bonusBands[${i}].bonusOmr`),
    };
  });
  for (const band of bands) {
    if (band.maxVolumeBaisa !== null && band.maxVolumeBaisa <= band.minVolumeBaisa) {
      throw new SeedError(`bonus band ${band.id}: max volume is not above min volume.`);
    }
  }
  return {
    currency: "OMR",
    advisorMonthlyTargetBaisa: money(o.advisorMonthlyTargetOmr, "settings.advisorMonthlyTargetOmr"),
    targetBandBaisa: money(o.targetBandOmr, "settings.targetBandOmr"),
    bonusBands: bands,
    holidays: arr(o.holidays, "settings.holidays").map((h, i) => date(h, `settings.holidays[${i}]`)),
  };
}

export function loadProvisions(json: unknown): Provision[] {
  const root = obj(json, "provisions.json");
  return arr(root.provisions, "provisions.json.provisions").map((raw, i) => {
    const where = `provisions[${i}]`;
    const o = obj(raw, where);
    return {
      id: str(o.id, `${where}.id`),
      label: bilingual(o.label, `${where}.label`),
      amountBaisa: moneyOrNull(o.amountOmr, `${where}.amountOmr`),
      flag: bilingual(o.flag, `${where}.flag`),
      status: oneOf(o.status, ["open", "settled", "dismissed"] as const, `${where}.status`),
    };
  });
}

export interface RawSeed {
  peopleJson: unknown;
  costPoliciesJson: unknown;
  settingsJson: unknown;
  provisionsJson: unknown;
  dealsCsv: string;
}

/** Build the whole dataset from the seed files. Throws on any inconsistency. */
export function loadDataset(raw: RawSeed): CeoDataset {
  const { people, advisorIdByName } = loadPeople(raw.peopleJson);
  const deals: Deal[] = importDealsCsv(raw.dealsCsv, { advisorIdByName });
  return {
    people,
    deals,
    costPolicies: loadCostPolicies(raw.costPoliciesJson),
    provisions: loadProvisions(raw.provisionsJson),
    settings: loadSettings(raw.settingsJson),
  };
}
