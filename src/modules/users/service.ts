import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { assertPermission } from "@/modules/permissions/service";
import { hashPassword, temporaryPassword } from "@/modules/auth/password";
import { audit, userSnapshot } from "@/modules/audit/service";
import { safeUserSelect, type SafeUser } from "./types";
import { userInputSchema, type UserInput, userFiltersSchema } from "./schema";
export async function validateReferences(tx: Prisma.TransactionClient, data: UserInput) {
  const [unit, category] = await Promise.all([
    tx.unit.findUnique({ where: { id: data.primaryUnitId } }),
    tx.professionalCategory.findUnique({ where: { id: data.professionalCategoryId } }),
  ]);
  if (!unit?.active || !category?.active)
    throw new AppError(400, "Unidade e categoria devem existir e estar ativas.");
}
export async function freshActor(tx: Prisma.TransactionClient, actor: SafeUser) {
  const current = await tx.user.findUniqueOrThrow({
    where: { id: actor.id },
    select: safeUserSelect,
  });
  assertPermission(current, "users:manage");
  return current;
}
export async function createUser(actor: SafeUser, input: unknown) {
  const data = userInputSchema.parse(input);
  assertPermission(actor, "users:manage");
  const password = temporaryPassword(),
    passwordHash = await hashPassword(password);
  const user = await prisma.$transaction(
    async (tx) => {
      await freshActor(tx, actor);
      await validateReferences(tx, data);
      const user = await tx.user.create({
        data: { ...data, passwordHash, mustChangePassword: true },
        select: safeUserSelect,
      });
      await audit(tx, actor.id, "USER_CREATED", "User", user.id, undefined, userSnapshot(user));
      return user;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
  return { user, temporaryPassword: password };
}
export async function updateUser(actor: SafeUser, id: string, input: unknown) {
  assertPermission(actor, "users:manage");
  const data = userInputSchema.parse(input);
  if (id === actor.id && (data.accessProfile !== actor.accessProfile || data.status !== "ACTIVE")) {
    await audit(prisma, actor.id, "SELF_ACCESS_CHANGE_DENIED", "User", id);
    throw new AppError(403, "Seu próprio perfil e status exigem outro administrador.");
  }
  return prisma.$transaction(
    async (tx) => {
      await freshActor(tx, actor);
      await validateReferences(tx, data);
      const previous = await tx.user.findUniqueOrThrow({ where: { id } });
      if (
        previous.accessProfile === "DIRECTION" &&
        previous.status === "ACTIVE" &&
        (data.accessProfile !== "DIRECTION" || data.status !== "ACTIVE") &&
        (await tx.user.count({ where: { accessProfile: "DIRECTION", status: "ACTIVE" } })) <= 1
      )
        throw new AppError(409, "Mantenha ao menos uma Direção ativa.");
      const user = await tx.user.update({ where: { id }, data, select: safeUserSelect });
      await audit(
        tx,
        actor.id,
        "USER_UPDATED",
        "User",
        id,
        userSnapshot(previous),
        userSnapshot(user),
      );
      const changes = {
        accessProfile: "PROFILE_CHANGED",
        professionalCategoryId: "CATEGORY_CHANGED",
        primaryUnitId: "UNIT_CHANGED",
        status: data.status === "ACTIVE" ? "USER_ACTIVATED" : "USER_INACTIVATED",
      };
      for (const field of Object.keys(changes) as (keyof typeof changes)[])
        if (previous[field] !== user[field])
          await audit(
            tx,
            actor.id,
            changes[field],
            "User",
            id,
            { [field]: previous[field] },
            { [field]: user[field] },
          );
      if (previous.accessProfile !== user.accessProfile || user.status === "INACTIVE")
        await tx.session.deleteMany({ where: { userId: id } });
      return user;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
export async function listUsers(actor: SafeUser, input: unknown) {
  assertPermission(actor, "users:read");
  const f = userFiltersSchema.parse(input);
  return prisma.user.findMany({
    where: {
      accessProfile: f.profile,
      professionalCategoryId: f.categoryId,
      primaryUnitId: f.unitId,
      status: f.status,
      ...(f.q
        ? {
            OR: ["name", "registrationNumber", "functionalIdentifier"].map((field) => ({
              [field]: { contains: f.q, mode: "insensitive" },
            })),
          }
        : {}),
    },
    select: safeUserSelect,
    orderBy: { name: "asc" },
    take: 200,
  });
}
