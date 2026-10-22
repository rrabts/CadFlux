import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { writeAudit } from "@/modules/audit/service";
import { authorizeAdministration } from "@/modules/permissions/administration";
import { assertPermission } from "@/modules/permissions/service";
import type { SafeUser } from "@/modules/users/types";
import {
  categoryInputSchema,
  referenceFiltersSchema,
  unitInputSchema,
  type ReferenceKind,
} from "./schema";

export async function listReferencePage(actor: SafeUser, kind: ReferenceKind, raw: unknown) {
  assertPermission(actor, "reference:read");
  const filters = referenceFiltersSchema.parse(raw);
  const active = filters.status ? filters.status === "active" : undefined;
  const pageSize = 50;
  const common = { skip: (filters.page - 1) * pageSize, take: pageSize };
  if (kind === "units") {
    const where: Prisma.UnitWhereInput = {
      ...(active !== undefined ? { active } : {}),
      ...(filters.q
        ? {
            OR: [
              { name: { contains: filters.q, mode: "insensitive" } },
              { code: { contains: filters.q, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const [items, total] = await prisma.$transaction([
      prisma.unit.findMany({
        ...common,
        where,
        orderBy: [{ name: "asc" }, { id: "asc" }],
        include: { _count: { select: { primaryUsers: true, authorizedUsers: true } } },
      }),
      prisma.unit.count({ where }),
    ]);
    return {
      items: items.map(({ _count, ...item }) => ({
        ...item,
        linkedUsers: _count.primaryUsers + _count.authorizedUsers,
      })),
      total,
      page: filters.page,
      pageSize,
    };
  }
  const where: Prisma.ProfessionalCategoryWhereInput = {
    ...(active !== undefined ? { active } : {}),
    ...(filters.q ? { name: { contains: filters.q, mode: "insensitive" } } : {}),
  };
  const [items, total] = await prisma.$transaction([
    prisma.professionalCategory.findMany({
      ...common,
      where,
      orderBy: [{ name: "asc" }, { id: "asc" }],
      include: { _count: { select: { users: true } } },
    }),
    prisma.professionalCategory.count({ where }),
  ]);
  return {
    items: items.map(({ _count, ...item }) => ({ ...item, linkedUsers: _count.users })),
    total,
    page: filters.page,
    pageSize,
  };
}

export async function getReference(actor: SafeUser, kind: ReferenceKind, id: string) {
  assertPermission(actor, "reference:read");
  const item =
    kind === "units"
      ? await prisma.unit.findUnique({ where: { id } })
      : await prisma.professionalCategory.findUnique({ where: { id } });
  if (!item) throw new AppError(404, "Cadastro não encontrado.");
  const history = await prisma.auditLog.findMany({
    where: { entityType: kind === "units" ? "Unit" : "ProfessionalCategory", entityId: id },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 100,
    include: { actor: { select: { name: true, email: true } } },
  });
  return { item, history: history.map(({ actor, ...entry }) => ({ ...entry, actorUser: actor })) };
}

export async function saveReference(
  actor: SafeUser,
  kind: ReferenceKind,
  raw: unknown,
  id?: string,
) {
  const unitInput = kind === "units" ? unitInputSchema.parse(raw) : null;
  const categoryInput = kind === "categories" ? categoryInputSchema.parse(raw) : null;
  try {
    return await prisma.$transaction(
      async (tx) => {
        await authorizeAdministration(tx, actor, "reference:manage");
        const previous = id
          ? kind === "units"
            ? await tx.unit.findUnique({ where: { id } })
            : await tx.professionalCategory.findUnique({ where: { id } })
          : null;
        if (id && !previous) throw new AppError(404, "Cadastro não encontrado.");
        const input = unitInput ?? categoryInput!;
        if (id && !input.active) {
          const linked =
            kind === "units"
              ? await tx.user.count({
                  where: {
                    status: "ACTIVE",
                    OR: [{ primaryUnitId: id }, { additionalUnits: { some: { unitId: id } } }],
                  },
                })
              : await tx.user.count({ where: { status: "ACTIVE", professionalCategoryId: id } });
          if (linked)
            throw new AppError(
              409,
              "Existem usuários ativos vinculados. Transfira os vínculos ou inative os usuários antes de inativar este cadastro.",
            );
        }
        if (categoryInput) {
          const duplicate = await tx.professionalCategory.findFirst({
            where: {
              name: { equals: categoryInput.name, mode: "insensitive" },
              ...(id ? { id: { not: id } } : {}),
            },
          });
          if (duplicate) throw new AppError(409, "Já existe uma categoria com esse nome.");
        }
        const item = unitInput
          ? id
            ? await tx.unit.update({ where: { id }, data: unitInput })
            : await tx.unit.create({ data: unitInput })
          : id
            ? await tx.professionalCategory.update({ where: { id }, data: categoryInput! })
            : await tx.professionalCategory.create({ data: categoryInput! });
        const prefix = kind === "units" ? "UNIT" : "CATEGORY";
        await writeAudit(tx, {
          actorUserId: actor.id,
          entityType: kind === "units" ? "Unit" : "ProfessionalCategory",
          entityId: item.id,
          action: !previous
            ? `${prefix}_CREATED`
            : previous.active !== item.active
              ? `${prefix}_${item.active ? "ACTIVATED" : "INACTIVATED"}`
              : `${prefix}_UPDATED`,
          previousValue: previous,
          newValue: item,
        });
        return item;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30000 },
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
      throw new AppError(
        409,
        kind === "units"
          ? "Já existe uma unidade com esse código."
          : "Já existe uma categoria com esse nome.",
      );
    throw error;
  }
}
