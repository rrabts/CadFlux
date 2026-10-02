import type { Prisma } from "@prisma/client";
export function audit(
  tx: Prisma.TransactionClient,
  actorUserId: string | null,
  action: string,
  entityType: string,
  entityId?: string,
  previousValue?: Prisma.InputJsonValue,
  newValue?: Prisma.InputJsonValue,
) {
  return tx.auditLog.create({
    data: { actorUserId, action, entityType, entityId, previousValue, newValue },
  });
}
// Only authorization-relevant values belong in audit snapshots. Never passwords, tokens or identifiers.
export function userSnapshot(user: {
  accessProfile: string;
  professionalCategoryId: string;
  primaryUnitId: string;
  status: string;
}) {
  return {
    accessProfile: user.accessProfile,
    professionalCategoryId: user.professionalCategoryId,
    primaryUnitId: user.primaryUnitId,
    status: user.status,
  };
}
