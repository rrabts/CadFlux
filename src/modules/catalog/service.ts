import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { writeAudit } from "@/modules/audit/service";
import type { SafeUser } from "@/modules/users/types";
import { operationActor } from "@/modules/operations/service";
import { kindLabels } from "@/modules/attendances/contracts";

export const catalogKind = z.enum(["benefits", "types"]);
type Kind = z.infer<typeof catalogKind>;
const inputSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2)
      .max(120)
      .transform((s) => s.replace(/\s+/g, " ")),
    active: z.boolean(),
    version: z.number().int().positive().optional(),
  })
  .strict();
const typeCode = z.enum(
  Object.keys(kindLabels) as [keyof typeof kindLabels, ...(keyof typeof kindLabels)[]],
);
export async function listCatalog(actor: SafeUser, kind: Kind, raw: unknown) {
  const filters = z
    .object({
      page: z.coerce.number().int().min(1).max(100000).default(1),
      q: z.string().trim().max(120).default(""),
    })
    .strict()
    .parse(raw);
  return prisma.$transaction(
    async (tx) => {
      await operationActor(tx, actor, "reference:read");
      const where = { name: { contains: filters.q, mode: "insensitive" as const } };
      const options = {
        where,
        skip: (filters.page - 1) * 50,
        take: 50,
        orderBy: { name: "asc" as const },
      };
      const items =
        kind === "benefits"
          ? await tx.benefit.findMany(options)
          : await tx.attendanceType.findMany(options);
      const total =
        kind === "benefits"
          ? await tx.benefit.count({ where })
          : await tx.attendanceType.count({ where });
      return { items, total, page: filters.page, pageSize: 50 };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
}
export async function catalogHistory(actor: SafeUser, kind: Kind, id: string) {
  return prisma.$transaction(async (tx) => {
    await operationActor(tx, actor, "reference:read");
    const history = await tx.auditLog.findMany({
      where: { entityType: kind === "benefits" ? "Benefit" : "AttendanceType", entityId: id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 100,
      include: { actor: { select: { name: true } } },
    });
    return { history: history.map(({ actor, ...entry }) => ({ ...entry, actorUser: actor })) };
  });
}
export async function saveCatalog(actor: SafeUser, kind: Kind, raw: unknown, id?: string) {
  const input = inputSchema.parse(raw);
  if (kind === "types" && !id) throw new AppError(400, "Os sete códigos de atendimento são fixos.");
  const code = kind === "types" ? typeCode.parse(id) : undefined;
  try {
    return await prisma.$transaction(
      async (tx) => {
        await operationActor(tx, actor, "reference:manage", true);
        const previous = id
          ? kind === "benefits"
            ? await tx.benefit.findUnique({ where: { id } })
            : await tx.attendanceType.findUnique({ where: { code: code! } })
          : null;
        if (id && !previous) throw new AppError(404, "Cadastro não encontrado.");
        if (previous && input.version !== previous.version)
          throw new AppError(409, "Cadastro alterado. Recarregue antes de salvar.");
        if (
          kind === "types" &&
          previous?.active &&
          !input.active &&
          (await tx.attendanceType.count({ where: { active: true } })) <= 1
        )
          throw new AppError(409, "Mantenha pelo menos um tipo ativo.");
        const data = { name: input.name, active: input.active };
        const item =
          kind === "benefits"
            ? id
              ? await tx.benefit.update({
                  where: { id, version: input.version },
                  data: { ...data, version: { increment: 1 } },
                })
              : await tx.benefit.create({ data })
            : await tx.attendanceType.update({
                where: { code: code!, version: input.version },
                data: { ...data, version: { increment: 1 } },
              });
        await writeAudit(tx, {
          actorUserId: actor.id,
          action: previous ? "CATALOG_UPDATED" : "CATALOG_CREATED",
          entityType: kind === "benefits" ? "Benefit" : "AttendanceType",
          entityId: id ?? ("id" in item ? item.id : null),
          previousValue: previous,
          newValue: item,
        });
        return item;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30000 },
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
      throw new AppError(409, "Já existe um cadastro com esse nome.");
    throw error;
  }
}
