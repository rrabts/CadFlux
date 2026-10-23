import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { safeUserSelect, type SafeUser } from "@/modules/users/types";
import { assertPermission, type Action } from "@/modules/permissions/service";
import { writeAudit } from "@/modules/audit/service";

export async function operationActor(
  tx: Prisma.TransactionClient,
  actor: SafeUser,
  action: Action,
  lock = false,
) {
  if (lock) await tx.$executeRaw`SELECT pg_advisory_xact_lock(194118, 1)`;
  const current = await tx.user.findUnique({ where: { id: actor.id }, select: safeUserSelect });
  if (!current) throw new AppError(401, "Entre para continuar.");
  assertPermission(current, action);
  return current;
}

export async function unitContext(tx: Prisma.TransactionClient, actor: SafeUser) {
  const user = await tx.user.findUniqueOrThrow({
    where: { id: actor.id },
    select: { operationalUnitId: true },
  });
  const units = await tx.unit.findMany({
    where: {
      active: true,
      OR: [{ id: actor.primaryUnitId }, { authorizedUsers: { some: { userId: actor.id } } }],
    },
    select: { id: true, name: true, code: true, timezone: true },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
  const preferred = units.find((u) => u.id === user.operationalUnitId);
  const selected = preferred ?? units.find((u) => u.id === actor.primaryUnitId) ?? null;
  return {
    units,
    selected,
    notice:
      user.operationalUnitId && !preferred
        ? "O local anterior não está disponível. Confira a unidade padrão."
        : "",
  };
}

export async function allowedUnit(
  tx: Prisma.TransactionClient,
  actor: SafeUser,
  requested?: string,
) {
  const context = await unitContext(tx, actor);
  const unit = requested ? context.units.find((u) => u.id === requested) : context.selected;
  if (!unit)
    throw new AppError(
      409,
      "Local de atendimento não autorizado ou inativo. Solicite regularização à Direção.",
    );
  return unit;
}

export async function setOperationalUnit(actor: SafeUser, raw: unknown) {
  const { unitId } = z
    .object({ unitId: z.string().min(1).max(100) })
    .strict()
    .parse(raw);
  return prisma.$transaction(
    async (tx) => {
      const current = await operationActor(tx, actor, "attendances:create", true);
      const unit = await allowedUnit(tx, current, unitId);
      const previous = await tx.user.findUniqueOrThrow({
        where: { id: current.id },
        select: { operationalUnitId: true },
      });
      if (previous.operationalUnitId !== unit.id) {
        await tx.user.update({ where: { id: current.id }, data: { operationalUnitId: unit.id } });
        await writeAudit(tx, {
          actorUserId: current.id,
          action: "OPERATIONAL_UNIT_CHANGED",
          entityType: "User",
          entityId: current.id,
          previousValue: previous,
          newValue: { operationalUnitId: unit.id },
        });
      }
      return unit;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30000 },
  );
}

export async function attendanceConfiguration(actor: SafeUser) {
  return prisma.$transaction(
    async (tx) => {
      const current = await operationActor(tx, actor, "attendances:read");
      const [types, benefits] = await Promise.all([
        tx.attendanceType.findMany({ orderBy: { code: "asc" } }),
        tx.benefit.findMany({ where: { active: true }, orderBy: [{ name: "asc" }, { id: "asc" }] }),
      ]);
      const context =
        current.accessProfile === "INTERVIEWER"
          ? await unitContext(tx, current)
          : { units: [], selected: null, notice: "" };
      return { types, benefits, ...context };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
}
