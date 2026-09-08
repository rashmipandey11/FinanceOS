import { prisma } from "../lib/prisma";

export async function logAudit(entry: {
  userId?: number | null;
  entityType: string;
  entityId: number;
  action: string;
  oldValue?: unknown;
  newValue?: unknown;
}) {
  await prisma.auditLog.create({
    data: {
      userId: entry.userId ?? null,
      entityType: entry.entityType,
      entityId: entry.entityId,
      action: entry.action,
      oldValue: entry.oldValue !== undefined ? JSON.stringify(entry.oldValue) : null,
      newValue: entry.newValue !== undefined ? JSON.stringify(entry.newValue) : null,
    },
  });
}
