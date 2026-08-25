// Pacing is on working days, never calendar days. Oman works Sunday to Thursday,
// so calendar pacing overstates elapsed time by up to 40% and turns a healthy
// month into a false alarm.
import { describe, expect, it } from "vitest";

import {
  MIN_WORKING_DAYS_FOR_PACE,
  addMonths,
  isWorkingDay,
  monthRange,
  monthsBetween,
  paceOfMonth,
  quarterOf,
  workingDaysBetween,
  workingDaysInMonth,
} from "../calendar";

describe("the Omani working week", () => {
  it("counts Sunday to Thursday and skips Friday and Saturday", () => {
    expect(isWorkingDay("2026-08-01")).toBe(false); // Saturday
    expect(isWorkingDay("2026-08-02")).toBe(true); // Sunday
    expect(isWorkingDay("2026-08-06")).toBe(true); // Thursday
    expect(isWorkingDay("2026-08-07")).toBe(false); // Friday
  });

  it("finds 22 working days in August 2026 and 20 in February 2026", () => {
    expect(workingDaysInMonth("2026-08")).toBe(22);
    expect(workingDaysInMonth("2026-02")).toBe(20);
  });

  it("subtracts holidays", () => {
    const holidays = new Set(["2026-08-03", "2026-08-04"]);
    expect(workingDaysInMonth("2026-08", holidays)).toBe(20);
  });

  it("returns zero for a backwards range rather than a negative count", () => {
    expect(workingDaysBetween("2026-08-10", "2026-08-01")).toBe(0);
  });
});

describe("pace", () => {
  it("reports 18 of 22 working days elapsed on 2026-08-25", () => {
    const pace = paceOfMonth("2026-08", "2026-08-25");
    expect(pace.elapsed).toBe(18);
    expect(pace.total).toBe(22);
    expect(pace.measurable).toBe(true);
  });

  it("diverges from calendar pacing by up to 40% — the reason this exists", () => {
    // February 2026 opens on a Sunday, so by Thursday the 5th a full working
    // week is done: 5 of 20 working days, a quarter of the month.
    const pace = paceOfMonth("2026-02", "2026-02-05");
    expect(pace.fraction).toBeCloseTo(5 / 20, 10);

    // Calendar pacing sees only 5 of 28 days and would project the month 40%
    // higher than it will actually land.
    const calendarFraction = 5 / 28;
    expect(pace.fraction / calendarFraction).toBeCloseTo(1.4, 10);
  });

  it("is not measurable before working day 3", () => {
    // August 2026 opens on a Saturday; the 2nd, 3rd and 4th are working days.
    expect(paceOfMonth("2026-08", "2026-08-02").measurable).toBe(false);
    expect(paceOfMonth("2026-08", "2026-08-03").measurable).toBe(false);
    expect(paceOfMonth("2026-08", "2026-08-04").elapsed).toBe(MIN_WORKING_DAYS_FOR_PACE);
    expect(paceOfMonth("2026-08", "2026-08-04").measurable).toBe(true);
  });

  it("clamps to a complete month once the month is over", () => {
    const pace = paceOfMonth("2026-08", "2026-12-31");
    expect(pace.elapsed).toBe(22);
    expect(pace.fraction).toBe(1);
  });

  it("reports nothing elapsed for a month that has not started", () => {
    const pace = paceOfMonth("2026-12", "2026-08-25");
    expect(pace.elapsed).toBe(0);
    expect(pace.measurable).toBe(false);
  });
});

describe("month arithmetic", () => {
  it("counts months inclusively", () => {
    expect(monthsBetween("2026-01", "2026-08")).toBe(8);
    expect(monthsBetween("2026-06", "2026-08")).toBe(3);
    expect(monthsBetween("2026-08", "2026-08")).toBe(1);
    expect(monthsBetween("2026-08", "2026-01")).toBe(0);
  });

  it("rolls over year boundaries", () => {
    expect(addMonths("2026-11", 3)).toBe("2027-02");
    expect(addMonths("2026-02", -3)).toBe("2025-11");
    expect(monthRange("2026-11", "2027-01")).toEqual(["2026-11", "2026-12", "2027-01"]);
  });

  it("places months in the right quarter", () => {
    expect(quarterOf("2026-08").quarter).toBe(3);
    expect(quarterOf("2026-08").months).toEqual(["2026-07", "2026-08", "2026-09"]);
  });
});
