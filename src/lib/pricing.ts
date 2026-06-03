/** Simple OMR → {USD, EUR, GBP, INR, SAR, AED} conversion table.
 * Update periodically; we treat these as indicative. */

export const EXCHANGE_RATES: Record<string, number> = {
  OMR: 1,
  USD: 2.6,
  EUR: 2.39,
  GBP: 2.05,
  AED: 9.55,
  SAR: 9.75,
  INR: 217.0,
  QAR: 9.47,
  KWD: 0.8,
};

export function convertFromOmr(amount: number, target: string): number {
  const rate = EXCHANGE_RATES[target.toUpperCase()];
  if (!rate) throw new Error(`Unsupported currency: ${target}`);
  return Math.round(amount * rate);
}

export function formatMoney(amount: number, currency: string): string {
  const c = currency.toUpperCase();
  const rounded = Math.round(amount);
  return `${c} ${rounded.toLocaleString("en-US")}`;
}

export function buildPriceTable(
  omrPrice: number,
  currencies: string[] = ["OMR", "USD", "EUR", "GBP", "INR"],
): string {
  const lines: string[] = [];
  for (const c of currencies) {
    if (c === "OMR") {
      lines.push(`${formatMoney(omrPrice, "OMR")} (primary)`);
    } else {
      lines.push(`~ ${formatMoney(convertFromOmr(omrPrice, c), c)}`);
    }
  }
  return lines.join("\n");
}
