// Audit trail. Every mutation records an entry; auditing must never block or
// fail the underlying operation.

export interface AuditEntry {
  actorId?: string | null;
  actorRole?: string | null;
  action: string; // e.g. "lead.created", "lead.assigned", "deal.closed"
  entity: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
}

export interface AuditPort {
  record(entry: AuditEntry): Promise<void>;
}

export async function recordAudit(port: AuditPort | null | undefined, entry: AuditEntry): Promise<void> {
  if (!port) return;
  try {
    await port.record(entry);
  } catch {
    // Never let an audit-log failure roll back the actual mutation.
  }
}
