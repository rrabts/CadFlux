import { Prisma } from "@prisma/client";
type AuditInput = {
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  previousValue?: unknown;
  newValue?: unknown;
  metadata?: unknown;
};
const secretKey = /password|senha|token|secret|recoveryHash|credential/i;
export function sanitizeAudit(value: unknown): Prisma.InputJsonValue | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(sanitizeAudit);
  if (typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !secretKey.test(key))
        .map(([key, item]) => [key, sanitizeAudit(item)]),
    );
  if (typeof value === "string" || typeof value === "boolean" || typeof value === "number")
    return value;
  return String(value);
}
export function writeAudit(tx: Prisma.TransactionClient, input: AuditInput) {
  return tx.auditLog.create({
    data: {
      actorUserId: input.actorUserId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      ...(input.previousValue !== undefined
        ? { previousValue: sanitizeAudit(input.previousValue) ?? Prisma.JsonNull }
        : {}),
      ...(input.newValue !== undefined
        ? { newValue: sanitizeAudit(input.newValue) ?? Prisma.JsonNull }
        : {}),
      ...(input.metadata !== undefined
        ? { metadata: sanitizeAudit(input.metadata) ?? Prisma.JsonNull }
        : {}),
    },
  });
}
