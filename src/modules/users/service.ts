import { Prisma, AccessProfile, UserStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { authorizeAdministration } from "@/modules/permissions/administration";
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

type UserWithUnits = SafeUser & { additionalUnitIds?: string[] };
export async function validateUserReferences(
  tx: Prisma.TransactionClient,
  input: UserInput,
  previous?: UserWithUnits,
) {
  const [category, unit] = await Promise.all([
    tx.professionalCategory.findUnique({ where: { id: input.professionalCategoryId } }),
    tx.unit.findUnique({ where: { id: input.primaryUnitId } }),
  ]);
  const keepingInactive = input.status === UserStatus.INACTIVE && !!previous;
  if (
    !category ||
    (!category.active && !(keepingInactive && previous?.professionalCategoryId === category.id))
  )
    throw new AppError(400, "Categoria inexistente ou inativa.");
  if (!unit || (!unit.active && !(keepingInactive && previous?.primaryUnitId === unit.id)))
    throw new AppError(400, "Unidade inexistente ou inativa.");
  const additionalIds = input.additionalUnitIds ?? previous?.additionalUnitIds ?? [];
  if (additionalIds.includes(input.primaryUnitId))
    throw new AppError(400, "A unidade principal não pode se repetir nas unidades adicionais.");
  const additional = await tx.unit.findMany({ where: { id: { in: additionalIds } } });
  if (
    additional.length !== additionalIds.length ||
    additional.some(
      (item) =>
        !item.active && !(keepingInactive && previous?.additionalUnitIds?.includes(item.id)),
    )
  )
    throw new AppError(400, "Unidades adicionais inexistentes ou inativas.");
}
export async function createUserInTransaction(
  tx: Prisma.TransactionClient,
  actor: SafeUser,
  raw: unknown,
) {
  await authorizeAdministration(tx, actor, "users:manage");
  const input = userInputSchema.parse(raw);
  await validateUserReferences(tx, input);
  const { additionalUnitIds = [], ...fields } = input;
  const temporaryPassword = generateTemporaryPassword();
  const user = await tx.user.create({
    data: {
      ...fields,
      additionalUnits: { create: additionalUnitIds.map((unitId) => ({ unitId })) },
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
    newValue: { ...user, additionalUnitIds },
  });
  return { user: { ...user, additionalUnitIds }, temporaryPassword };
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
      await authorizeAdministration(tx, actor, "users:manage");
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
      const oldLinks = await tx.userUnitAccess.findMany({
        where: { userId: id },
        orderBy: { unitId: "asc" },
      });
      const previousIds = oldLinks.map((link) => link.unitId);
      const nextIds = input.additionalUnitIds ?? previousIds;
      await validateUserReferences(tx, input, { ...previous, additionalUnitIds: previousIds });
      const { additionalUnitIds, ...fields } = input;
      const unitsChanged = JSON.stringify(previousIds) !== JSON.stringify(nextIds);
      const user = await tx.user.update({
        where: { id },
        data: {
          ...fields,
          ...(additionalUnitIds !== undefined
            ? { additionalUnits: { deleteMany: {}, create: nextIds.map((unitId) => ({ unitId })) } }
            : {}),
        },
        select: safeUserSelect,
      });
      await writeAudit(tx, {
        actorUserId: actor.id,
        action: "USER_UPDATED",
        entityType: "User",
        entityId: id,
        previousValue: { ...previous, additionalUnitIds: previousIds },
        newValue: { ...user, additionalUnitIds: nextIds },
      });
      const changes: [Exclude<keyof UserInput, "additionalUnitIds">, string][] = [
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
      if (unitsChanged)
        await writeAudit(tx, {
          actorUserId: actor.id,
          action: "USER_ADDITIONAL_UNITS_CHANGED",
          entityType: "User",
          entityId: id,
          previousValue: { additionalUnitIds: previousIds },
          newValue: { additionalUnitIds: nextIds },
        });
      if (
        previous.accessProfile !== input.accessProfile ||
        previous.status !== input.status ||
        previous.primaryUnitId !== input.primaryUnitId ||
        unitsChanged
      )
        await tx.session.deleteMany({ where: { userId: id } });
      return { ...user, additionalUnitIds: nextIds };
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
