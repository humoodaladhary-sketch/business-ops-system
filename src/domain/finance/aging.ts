// Deterministic invoice aging — the backbone of the collections chase.
// Pure functions over verified dates only: an invoice with no due date is
// never guessed into a bucket, it is classified "due_date_unverified" and
// surfaced for the owner to fix. Outstanding is NEVER conflated with overdue.

export type AgingBucket =
  | "not_yet_due"
  | "due_soon" // due today or within the next 7 days
  | "overdue_1_7"
  | "overdue_8_30"
  | "overdue_31_60"
  | "overdue_61_90"
  | "overdue_90_plus"
  | "due_date_unverified";

export const AGING_BUCKET_LABELS: Record<AgingBucket, string> = {
  not_yet_due: "Not yet due",
  due_soon: "Due within 7 days",
  overdue_1_7: "1–7 days overdue",
  overdue_8_30: "8–30 days overdue",
  overdue_31_60: "31–60 days overdue",
  overdue_61_90: "61–90 days overdue",
  overdue_90_plus: "90+ days overdue",
  due_date_unverified: "Due date unverified",
};

/** Invoice statuses that still carry money to collect. */
export const OPEN_INVOICE_STATUSES = ["draft", "sent", "partially_paid", "overdue"] as const;

export interface AgingInput {
  dueDate: string | null; // YYYY-MM-DD (or ISO timestamp)
  asOf: Date;
}

export interface AgingResult {
  bucket: AgingBucket;
  /** Whole days past due; null when not overdue or unverifiable. */
  daysOverdue: number | null;
}

const DAY_MS = 86_400_000;
const utcDay = (d: Date) => Math.floor(d.getTime() / DAY_MS);

export function classifyAging({ dueDate, asOf }: AgingInput): AgingResult {
  if (!dueDate) return { bucket: "due_date_unverified", daysOverdue: null };
  const due = new Date(dueDate.length === 10 ? `${dueDate}T00:00:00Z` : dueDate);
  if (Number.isNaN(due.getTime())) return { bucket: "due_date_unverified", daysOverdue: null };
  const days = utcDay(asOf) - utcDay(due);
  if (days <= 0) {
    return { bucket: days >= -7 ? "due_soon" : "not_yet_due", daysOverdue: null };
  }
  if (days <= 7) return { bucket: "overdue_1_7", daysOverdue: days };
  if (days <= 30) return { bucket: "overdue_8_30", daysOverdue: days };
  if (days <= 60) return { bucket: "overdue_31_60", daysOverdue: days };
  if (days <= 90) return { bucket: "overdue_61_90", daysOverdue: days };
  return { bucket: "overdue_90_plus", daysOverdue: days };
}

export interface AgingInvoice {
  reference: string | null;
  developer: string | null;
  amountOmr: number;
  status: string; // invoice_status enum value
  dueDate: string | null;
}

export interface AgedInvoice extends AgingInvoice {
  bucket: AgingBucket;
  daysOverdue: number | null;
}

export interface AgingSummary {
  /** Per-bucket totals over OPEN invoices (full invoice amounts — recorded
   *  collections are tracked separately and reported alongside, never
   *  silently netted without per-invoice allocation). */
  buckets: Record<AgingBucket, { count: number; amountOmr: number }>;
  openCount: number;
  openAmountOmr: number;
  overdueCount: number;
  overdueAmountOmr: number;
  /** Open invoices sorted worst-first: most days overdue, then largest amount;
   *  unverified-due-date rows follow verified overdue rows. */
  queue: AgedInvoice[];
}

const emptyBuckets = (): AgingSummary["buckets"] =>
  Object.fromEntries(
    (Object.keys(AGING_BUCKET_LABELS) as AgingBucket[]).map((b) => [b, { count: 0, amountOmr: 0 }]),
  ) as AgingSummary["buckets"];

const OVERDUE_BUCKETS: AgingBucket[] = ["overdue_1_7", "overdue_8_30", "overdue_31_60", "overdue_61_90", "overdue_90_plus"];

export function summarizeAging(invoices: AgingInvoice[], asOf: Date): AgingSummary {
  const buckets = emptyBuckets();
  const open = invoices.filter((i) => (OPEN_INVOICE_STATUSES as readonly string[]).includes(i.status));
  const queue: AgedInvoice[] = open.map((i) => {
    const { bucket, daysOverdue } = classifyAging({ dueDate: i.dueDate, asOf });
    buckets[bucket].count += 1;
    buckets[bucket].amountOmr += i.amountOmr;
    return { ...i, bucket, daysOverdue };
  });
  queue.sort((a, b) => {
    const ad = a.daysOverdue ?? -1;
    const bd = b.daysOverdue ?? -1;
    if (ad !== bd) return bd - ad;
    return b.amountOmr - a.amountOmr;
  });
  const overdue = queue.filter((q) => OVERDUE_BUCKETS.includes(q.bucket));
  return {
    buckets,
    openCount: open.length,
    openAmountOmr: open.reduce((s, i) => s + i.amountOmr, 0),
    overdueCount: overdue.length,
    overdueAmountOmr: overdue.reduce((s, i) => s + i.amountOmr, 0),
    queue,
  };
}
