// "Smart" phone intelligence — derive dialing code, country and flag from a raw
// phone string (as stored in the agent sheets). Longest-prefix match over a
// dialing-code table covering the countries seen in Alwalaa's real lead data.

interface Dial {
  code: string; // dialing code without '+'
  iso: string; // ISO-3166 alpha-2
  country: string;
}

// Ordered so longest codes are tried first (built below).
const DIALS: Dial[] = [
  { code: "968", iso: "OM", country: "Oman" },
  { code: "971", iso: "AE", country: "United Arab Emirates" },
  { code: "966", iso: "SA", country: "Saudi Arabia" },
  { code: "974", iso: "QA", country: "Qatar" },
  { code: "973", iso: "BH", country: "Bahrain" },
  { code: "965", iso: "KW", country: "Kuwait" },
  { code: "962", iso: "JO", country: "Jordan" },
  { code: "961", iso: "LB", country: "Lebanon" },
  { code: "964", iso: "IQ", country: "Iraq" },
  { code: "967", iso: "YE", country: "Yemen" },
  { code: "960", iso: "MV", country: "Maldives" },
  { code: "20", iso: "EG", country: "Egypt" },
  { code: "212", iso: "MA", country: "Morocco" },
  { code: "216", iso: "TN", country: "Tunisia" },
  { code: "234", iso: "NG", country: "Nigeria" },
  { code: "233", iso: "GH", country: "Ghana" },
  { code: "44", iso: "GB", country: "United Kingdom" },
  { code: "33", iso: "FR", country: "France" },
  { code: "49", iso: "DE", country: "Germany" },
  { code: "48", iso: "PL", country: "Poland" },
  { code: "39", iso: "IT", country: "Italy" },
  { code: "34", iso: "ES", country: "Spain" },
  { code: "31", iso: "NL", country: "Netherlands" },
  { code: "372", iso: "EE", country: "Estonia" },
  { code: "420", iso: "CZ", country: "Czechia" },
  { code: "421", iso: "SK", country: "Slovakia" },
  { code: "353", iso: "IE", country: "Ireland" },
  { code: "7", iso: "RU", country: "Russia" },
  { code: "90", iso: "TR", country: "Turkey" },
  { code: "91", iso: "IN", country: "India" },
  { code: "92", iso: "PK", country: "Pakistan" },
  { code: "880", iso: "BD", country: "Bangladesh" },
  { code: "93", iso: "AF", country: "Afghanistan" },
  { code: "98", iso: "IR", country: "Iran" },
  { code: "86", iso: "CN", country: "China" },
  { code: "81", iso: "JP", country: "Japan" },
  { code: "82", iso: "KR", country: "South Korea" },
  { code: "60", iso: "MY", country: "Malaysia" },
  { code: "65", iso: "SG", country: "Singapore" },
  { code: "63", iso: "PH", country: "Philippines" },
  { code: "61", iso: "AU", country: "Australia" },
  { code: "64", iso: "NZ", country: "New Zealand" },
  { code: "1", iso: "US", country: "United States / Canada" },
].sort((a, b) => b.code.length - a.code.length);

export interface PhoneMeta {
  raw: string;
  e164: string | null; // '+' + digits
  code: string | null; // dialing code
  iso: string | null;
  country: string | null;
  flag: string; // emoji
  national: string | null; // remainder after the code
}

const INVISIBLES = /[‎‏‪-‮ ⁠‑]/g;

function flagFor(iso: string | null): string {
  if (!iso || iso.length !== 2) return "🌐";
  const A = 0x1f1e6;
  return String.fromCodePoint(A + (iso.charCodeAt(0) - 65), A + (iso.charCodeAt(1) - 65));
}

export function phoneMeta(raw: string | null | undefined): PhoneMeta {
  const s = String(raw ?? "").replace(INVISIBLES, "").trim();
  const digits = s.replace(/[^\d]/g, "");
  if (!digits) return { raw: s, e164: null, code: null, iso: null, country: null, flag: "🌐", national: null };
  const e164 = "+" + digits;
  const match = DIALS.find((d) => digits.startsWith(d.code));
  if (!match) return { raw: s, e164, code: null, iso: null, country: null, flag: "🌐", national: digits };
  return {
    raw: s,
    e164,
    code: match.code,
    iso: match.iso,
    country: match.country,
    flag: flagFor(match.iso),
    national: digits.slice(match.code.length),
  };
}
