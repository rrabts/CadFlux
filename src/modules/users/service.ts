import { Prisma, AccessProfile, UserStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { assertPermission } from "@/modules/permissions/service";
import { generateTemporaryPassword, hashPassword } from "@/modules/auth/password";
import { writeAudit } from "@/modules/audit/service";
import {
  userFiltersSchema,
  userInputSchema,
  normalizeFunctionalIdentifier,
  type UserInput,
} from "./schema";
import { safeUserSelect, type SafeUser } from "./types";
export { safeUserSelect };
export function serializeUser(user: SafeUser) {
  return {
    ...user,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
  };
}

async function authorizeTransaction(tx: Prisma.TransactionClient, actor: SafeUser) {
  // Administrative changes share a lock so the last active director cannot disappear in a race.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(194118, 1)`;
  const current = await tx.user.findUnique({ where: { id: actor.id }, select: safeUserSelect });
  if (!current) throw new AppError(401, "Entre para continuar.");
  assertPermission(current, "users:manage");
}
export async function validateUserReferences(tx: Prisma.TransactionClient, input: UserInput) {
  const [category, unit] = await Promise.all([
    tx.professionalCategory.findUnique({ where: { id: input.professionalCategoryId } }),
    tx.unit.findUnique({ where: { id: input.primaryUnitId } }),
  ]);
  if (!category?.active) throw new AppError(400, "Categoria inexistente ou inativa.");
  if (!unit?.active) throw new AppError(400, "Unidade inexistente ou inativa.");
}
export async function createUserInTransaction(
  tx: Prisma.TransactionClient,
  actor: SafeUser,
  raw: unknown,
) {
  await authorizeTransaction(tx, actor);
  const input = userInputSchema.parse(raw);
  await validateUserReferences(tx, input);
  const temporaryPassword = generateTemporaryPassword();
  const user = await tx.user.create({
    data: {
      ...input,
      passwordHash: await hashPassword(temporaryPassword),
      mustChangePassword: true,
    },
    select: safeUserSelect,
  });
  await writeAudit(tx, {
    actorUserId: actor.id,
    action: "USER_CREATED",
    entityType: "User",
    entityId: user.id,
    newValue: user,
  });
  return { user, temporaryPassword };
}
export async function createUser(actor: SafeUser, input: unknown) {
  return prisma.$transaction((tx) => createUserInTransaction(tx, actor, input), {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    timeout: 30000,
  });
}
export async function updateUser(actor: SafeUser, id: string, raw: unknown) {
  const input = userInputSchema.parse(raw);
  return prisma.$transaction(
    async (tx) => {
      await authorizeTransaction(tx, actor);
      const previous = await tx.user.findUnique({ where: { id }, select: safeUserSelect });
      if (!previous) throw new AppError(404, "Usuário não encontrado.");
      if (
        actor.id === id &&
        (input.accessProfile !== previous.accessProfile || input.status !== previous.status)
      )
        throw new AppError(403, "Outro administrador deve alterar seu perfil ou status.");
      if (
        previous.accessProfile === AccessProfile.DIRECTION &&
        previous.status === UserStatus.ACTIVE &&
        (input.accessProfile !== AccessProfile.DIRECTION || input.status !== UserStatus.ACTIVE)
      ) {
        if (
          (await tx.user.count({
            where: { accessProfile: AccessProfile.DIRECTION, status: UserStatus.ACTIVE },
          })) <= 1
        )
          throw new AppError(409, "Mantenha ao menos uma Direção ativa.");
      }
      await validateUserReferences(tx, input);
      const user = await tx.user.update({ where: { id }, data: input, select: safeUserSelect });
      await writeAudit(tx, {
        actorUserId: actor.id,
        action: "USER_UPDATED",
        entityType: "User",
        entityId: id,
        previousValue: previous,
        newValue: user,
      });
      const changes: [keyof UserInput, string][] = [
        ["accessProfile", "USER_PROFILE_CHANGED"],
        ["professionalCategoryId", "USER_CATEGORY_CHANGED"],
        ["primaryUnitId", "USER_UNIT_CHANGED"],
        ["status", input.status === UserStatus.ACTIVE ? "USER_ACTIVATED" : "USER_INACTIVATED"],
      ];
      for (const [key, action] of changes)
        if (previous[key] !== input[key])
          await writeAudit(tx, {
            actorUserId: actor.id,
            action,
            entityType: "User",
            entityId: id,
            previousValue: { [key]: previous[key] },
            newValue: { [key]: input[key] },
          });
      if (previous.accessProfile !== input.accessProfile || previous.status !== input.status)
        await tx.session.deleteMany({ where: { userId: id } });
      return user;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30000 },
  );
}
export async function listUsersPage(actor: SafeUser, raw: unknown) {
  assertPermission(actor, "users:read");
  const f = userFiltersSchema.parse(raw);
  const where: Prisma.UserWhereInput = {
    ...(f.profile ? { accessProfile: f.profile } : {}),
    ...(f.status ? { status: f.status } : {}),
    ...(f.categoryId ? { professionalCategoryId: f.categoryId } : {}),
    ...(f.unitId ? { primaryUnitId: f.unitId } : {}),
    ...(f.q
      ? {
          OR: ["name", "email", "registrationNumber", "functionalIdentifier"].map((field) => ({
            [field]: {
              contains:
                field === "functionalIdentifier"
                  ? (normalizeFunctionalIdentifier(f.q) ?? f.q)
                  : f.q,
              mode: "insensitive",
            },
          })),
        }
      : {}),
  };
  const pageSize = 50;
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: safeUserSelect,
      orderBy: [{ name: "asc" }, { id: "asc" }],
      take: pageSize,
      skip: (f.page - 1) * pageSize,
    }),
    prisma.user.count({ where }),
  ]);
  return { users, total, page: f.page, pageSize };
}
export async function listUsers(actor: SafeUser, raw: unknown) {
  return (await listUsersPage(actor, raw)).users;
}
