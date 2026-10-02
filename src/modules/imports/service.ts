import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { writeAudit } from "@/modules/audit/service";
import { assertPermission } from "@/modules/permissions/service";
import { createUserInTransaction, serializeUser, safeUserSelect } from "@/modules/users/service";
import { normalizeFunctionalIdentifier } from "@/modules/users/schema";
import type { SafeUser } from "@/modules/users/types";
import {
  IMPORT_COLUMNS,
  IMPORT_PREVIEW_TTL_MS,
  MAX_IMPORT_ROWS,
  type ImportPreview,
  type ParsedImportRow,
} from "./types";
import { parseImportFile, sanitizeImportFileName } from "./parser";
import { validateImportRows } from "./validation";

const storedRowsSchema = z
  .array(
    z
      .object({
        line: z.number().int().min(2),
        values: z
          .object(
            Object.fromEntries(
              IMPORT_COLUMNS.map((column) => [column, z.string().max(500)]),
            ) as Record<(typeof IMPORT_COLUMNS)[number], z.ZodString>,
          )
          .strict(),
        errors: z.array(z.string().max(500)).max(32),
      })
      .strict(),
  )
  .min(1)
  .max(MAX_IMPORT_ROWS);

async function freshActor(tx: Prisma.TransactionClient, actor: SafeUser): Promise<SafeUser> {
  const current = await tx.user.findUnique({ where: { id: actor.id }, select: safeUserSelect });
  if (!current) throw new AppError(401, "Sessão inválida.");
  assertPermission(current, "users:manage");
  return current;
}

async function validateWithDatabase(tx: Prisma.TransactionClient, rows: ParsedImportRow[]) {
  const [categories, units, existingUsers] = await Promise.all([
    tx.professionalCategory.findMany({ select: { id: true, name: true, active: true } }),
    tx.unit.findMany({ select: { id: true, name: true, code: true, active: true } }),
    tx.user.findMany({
      where: {
        OR: [
          { email: { in: rows.map((row) => row.values.email.toLowerCase()) } },
          { registrationNumber: { in: rows.map((row) => row.values.matricula.toUpperCase()) } },
          {
            functionalIdentifier: {
              in: rows.map(
                (row) => normalizeFunctionalIdentifier(row.values.cpf_ou_identificador) || "",
              ),
            },
          },
        ],
      },
      select: { email: true, registrationNumber: true, functionalIdentifier: true },
    }),
  ]);
  return validateImportRows(rows, { categories, units, existingUsers });
}

export async function createImportPreview(
  actor: SafeUser,
  bytes: Uint8Array,
  originalName: string,
): Promise<ImportPreview> {
  assertPermission(actor, "users:manage");
  const parsed = await parseImportFile(bytes, originalName);
  const fileName = sanitizeImportFileName(originalName);
  const expiresAt = new Date(Date.now() + IMPORT_PREVIEW_TTL_MS);
  return prisma.$transaction(
    async (tx) => {
      const current = await freshActor(tx, actor);
      const rows = await validateWithDatabase(tx, parsed);
      const batch = await tx.userImportBatch.create({
        data: {
          actorUserId: current.id,
          rows: JSON.parse(JSON.stringify(parsed)) as Prisma.InputJsonValue,
          total: parsed.length,
          expiresAt,
        },
      });
      const invalid = rows.filter((row) => row.errors.length).length;
      return {
        batchId: batch.id,
        fileName,
        total: rows.length,
        valid: rows.length - invalid,
        invalid,
        duplicates: rows.filter((row) => row.duplicate).length,
        rows,
        expiresAt: expiresAt.toISOString(),
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000 },
  );
}

export async function confirmImport(actor: SafeUser, batchId: string) {
  assertPermission(actor, "users:manage");
  return prisma.$transaction(
    async (tx) => {
      const current = await freshActor(tx, actor);
      const batch = await tx.userImportBatch.findFirst({
        where: { id: batchId, actorUserId: current.id },
      });
      if (!batch) throw new AppError(404, "Prévia de importação não encontrada.");
      if (batch.status !== "PREVIEW")
        throw new AppError(409, "Esta prévia já foi confirmada ou não está disponível.");
      if (batch.expiresAt.getTime() <= Date.now())
        throw new AppError(410, "A prévia expirou. Envie o arquivo novamente.");
      const stored = storedRowsSchema.safeParse(batch.rows);
      if (!stored.success || stored.data.length !== batch.total)
        throw new AppError(400, "Prévia inválida. Envie o arquivo novamente.");
      const rows = await validateWithDatabase(tx, stored.data);
      if (rows.some((row) => row.errors.length))
        throw new AppError(
          409,
          "Há linhas inválidas ou novos conflitos. Corrija o arquivo e gere uma nova prévia.",
        );
      const claim = await tx.userImportBatch.updateMany({
        where: {
          id: batch.id,
          actorUserId: current.id,
          status: "PREVIEW",
          expiresAt: { gt: new Date() },
        },
        data: { status: "CONFIRMED", confirmedAt: new Date() },
      });
      if (claim.count !== 1)
        throw new AppError(409, "A prévia foi consumida ou expirou. Envie o arquivo novamente.");
      const created = [];
      for (const row of rows) created.push(await createUserInTransaction(tx, current, row.data));
      await writeAudit(tx, {
        actorUserId: current.id,
        action: "USER_IMPORT_CONFIRMED",
        entityType: "UserImportBatch",
        entityId: batch.id,
        metadata: { total: created.length, userIds: created.map(({ user }) => user.id) },
      });
      return {
        created: created.length,
        total: created.length,
        users: created.map(({ user }) => serializeUser(user)),
        credentials: created.map(({ user, temporaryPassword }) => ({
          name: user.name,
          email: user.email,
          temporaryPassword,
        })),
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 120000 },
  );
}
