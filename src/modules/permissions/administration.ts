import type { Prisma } from "@prisma/client";
import { AppError } from "@/lib/errors";
import { safeUserSelect, type SafeUser } from "@/modules/users/types";
import { assertPermission } from "./service";

export async function authorizeAdministration(
  tx: Prisma.TransactionClient,
  actor: SafeUser,
  action: "users:manage" | "reference:manage",
) {
  // Share the existing administrative lock with imports, user edits and reference changes.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(194118, 1)`;
  const current = await tx.user.findUnique({ where: { id: actor.id }, select: safeUserSelect });
  if (!current) throw new AppError(401, "Entre para continuar.");
  assertPermission(current, action);
}
