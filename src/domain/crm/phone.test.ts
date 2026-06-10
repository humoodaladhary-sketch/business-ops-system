import { describe, it, expect } from "vitest";
import { parsePhone, phoneKey } from "./phone";

describe("parsePhone (libphonenumber)", () => {
  it("parses an E.164 number with its country", () => {
    const us = parsePhone("+12133734253");
    expect(us.valid).toBe(true);
    expect(us.country).toBe("US");
    expect(us.e164).toBe("+12133734253");
  });

  it("parses an Oman local number with the default region", () => {
    const om = parsePhone("9123 4567");
    expect(om.country).toBe("OM");
    expect(om.e164).toBe("+96891234567");
    expect(om.valid).toBe(true);
  });

  it("strips invisibles and yields an E.164 dedup key", () => {
    expect(phoneKey("‪+968 9123 4567‬")).toBe("+96891234567");
  });

  it("returns invalid/null for junk", () => {
    expect(parsePhone("not a phone").valid).toBe(false);
    expect(phoneKey("")).toBeNull();
  });
});
