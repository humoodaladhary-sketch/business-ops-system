import type { AuditEntry, AuditPort } from "@/application/audit";
import { hasDatabase, prisma } from "./client";

export class PrismaAuditRepo implements AuditPort {
  async record(e: AuditEntry): Promise<void> {
    if (!hasDatabase) return;
    await prisma.auditLog.create({
      data: {
        actorId: e.actorId ?? null,
        actorRole: e.actorRole ?? null,
        action: e.action,
        entity: e.entity,
        entityId: e.entityId ?? null,
        before: (e.before as never) ?? undefined,
        after: (e.after as never) ?? undefined,
        ip: e.ip ?? null,
      },
    });
  }
}
