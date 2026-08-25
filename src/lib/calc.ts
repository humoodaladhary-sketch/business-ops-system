// CEO Command Center — the one place the maths lives.
//
// Every formula in the system is here or re-exported from here. The screens
// call it, the API calls it, nothing else implements any of it. If a number
// appears on a screen that this module cannot produce, that is a bug.
//
// The implementation is split across `src/domain/ceo/*` so it stays testable
// and framework-free (the repo's domain layer imports no ORM and no React);
// this file is the public surface.
//
//   baisa.ts     money as integer baisa — 1 OMR = 1000 baisa, never a float
//   calendar.ts  months, the Sun–Thu working week, pace
//   types.ts     the domain model
//   cost.ts      effective-dated cost policy, personCost, break-even
//   deals.ts     companyNet and the derived rates
//   person.ts    contribution, payback, trend, bonus bands
//   company.ts   month state, projection, standings
//   csv.ts       importing the deal book
//   seed.ts      loading and validating the seed files
//
// Pure functions only. No database calls inside any of them.

export * from "@/domain/ceo/baisa";
export * from "@/domain/ceo/calendar";
export * from "@/domain/ceo/types";
export * from "@/domain/ceo/cost";
export * from "@/domain/ceo/deals";
export * from "@/domain/ceo/person";
export * from "@/domain/ceo/company";
export * from "@/domain/ceo/csv";
export * from "@/domain/ceo/seed";
