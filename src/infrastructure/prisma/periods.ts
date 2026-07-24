// 'YYYY-MM' helpers for month/quarter date ranges (UTC).

export function monthRange(period: string): { start: Date; end: Date } {
  const [y, m] = period.split("-").map(Number);
  return { start: new Date(Date.UTC(y, m - 1, 1)), end: new Date(Date.UTC(y, m, 1)) };
}

export function quarterRange(period: string): { start: Date; end: Date } {
  const [y, m] = period.split("-").map(Number);
  const q = Math.floor((m - 1) / 3); // 0..3
  return { start: new Date(Date.UTC(y, q * 3, 1)), end: new Date(Date.UTC(y, q * 3 + 3, 1)) };
}

export function currentPeriod(now = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}
