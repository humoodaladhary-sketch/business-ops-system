// libphonenumber-js wrapper for C1 capture. Inbound webhook numbers are usually
// E.164; a default region (Oman) handles local-format numbers.
import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

const INVISIBLES = /[‎‏‪-‮ ⁠‑]/g;

export interface PhoneParse {
  valid: boolean;
  e164: string | null;
  country: CountryCode | null;
  national: string | null;
}

export function parsePhone(raw: string | null | undefined, defaultCountry: CountryCode = "OM"): PhoneParse {
  const s = String(raw ?? "").replace(INVISIBLES, "").trim();
  if (!s) return { valid: false, e164: null, country: null, national: null };
  const parsed = parsePhoneNumberFromString(s, s.startsWith("+") ? undefined : defaultCountry);
  if (!parsed) return { valid: false, e164: null, country: null, national: null };
  return {
    valid: parsed.isValid(),
    e164: parsed.number,
    country: parsed.country ?? null,
    national: parsed.nationalNumber,
  };
}

/** Normalized E.164 key used for dedup; null if unparseable. */
export function phoneKey(raw: string | null | undefined, defaultCountry: CountryCode = "OM"): string | null {
  return parsePhone(raw, defaultCountry).e164;
}
