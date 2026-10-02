import { validIdentifier, normalizeIdentifier } from "@/modules/users/identifier";
export { validIdentifier } from "@/modules/users/identifier";
import ExcelJS from "exceljs";
import { parse } from "csv-parse/sync";
import { unzipSync, Unzip, UnzipInflate } from "fflate";
import { IMPORT_COLUMNS, MAX_IMPORT_BYTES, MAX_IMPORT_ROWS, IMPORT_PREVIEW_TTL_MS } from "./types";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { userInputSchema, type UserInput } from "@/modules/users/schema";
import { freshActor, validateReferences } from "@/modules/users/service";
import type { SafeUser } from "@/modules/users/types";
import { assertPermission } from "@/modules/permissions/service";
import { hashPassword, temporaryPassword } from "@/modules/auth/password";
import { audit, userSnapshot } from "@/modules/audit/service";
export const columns = [...IMPORT_COLUMNS];
export const MAX_BYTES = MAX_IMPORT_BYTES,
  MAX_ROWS = MAX_IMPORT_ROWS;
export type RawRow = Record<string, string>;
export type ReviewRow = {
  line: number;
  data: RawRow;
  errors: string[];
  duplicate: boolean;
  input?: UserInput;
};
export async function parseFile(name: string, buffer: Buffer): Promise<RawRow[]> {
  if (buffer.length > MAX_BYTES || !buffer.length)
    throw new AppError(400, "Arquivo vazio ou acima de 2 MB.");
  const safeName = name.replace(/[^a-zA-Z0-9._-]/g, "_");
  let matrix: string[][];
  if (/\.csv$/i.test(safeName)) {
    if (buffer.includes(0)) throw new AppError(400, "CSV inválido. Use UTF-8.");
    let text: string;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    } catch {
      throw new AppError(400, "CSV deve estar em UTF-8.");
    }
    try {
      matrix = parse(text, {
        bom: true,
        skip_empty_lines: false,
        delimiter: text.split("\n")[0].includes(";") ? ";" : ",",
        max_record_size: 8192,
        to: MAX_ROWS + 2,
      }) as string[][];
    } catch {
      throw new AppError(400, "CSV malformado.");
    }
  } else if (/\.xlsx$/i.test(safeName)) {
    if (buffer.length < 4 || buffer.readUInt16LE(0) !== 0x4b50)
      throw new AppError(400, "Formato XLSX inválido.");
    // Bound expanded ZIP size before ExcelJS sees XML (including compressed zip bombs).
    let expanded = 0,
      entries = 0;
    try {
      unzipSync(buffer, {
        filter: (file) => {
          expanded += file.originalSize;
          entries++;
          if (
            expanded > 12 * 1024 * 1024 ||
            entries > 100 ||
            /vbaProject|externalLinks/i.test(file.name)
          )
            throw new Error();
          return false;
        },
      });
      // Verify actual inflated bytes too: ZIP size headers are untrusted.
      let actualBytes = 0;
      let actualEntries = 0;
      const stream = new Unzip((file) => {
        if (++actualEntries > 100 || /vbaProject|externalLinks/i.test(file.name))
          throw new Error("Archive policy");
        file.ondata = (error, chunk) => {
          if (error) throw error;
          actualBytes += chunk.length;
          if (actualBytes > 12 * 1024 * 1024) throw new Error("Expanded size");
        };
        file.start();
      });
      stream.register(UnzipInflate);
      for (let offset = 0; offset < buffer.length; offset += 512) {
        stream.push(buffer.subarray(offset, offset + 512), offset + 512 >= buffer.length);
      }
    } catch {
      throw new AppError(400, "XLSX excede limites ou contém conteúdo não permitido.");
    }
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
    } catch {
      throw new AppError(400, "XLSX inválido.");
    }
    if (workbook.worksheets.length !== 1) throw new AppError(400, "Use uma única planilha.");
    const sheet = workbook.worksheets[0];
    if (sheet.rowCount > MAX_ROWS + 1 || sheet.columnCount > columns.length)
      throw new AppError(400, "Máximo de 500 linhas e 8 colunas.");
    matrix = [];
    sheet.eachRow({ includeEmpty: true }, (row) => {
      const cells: string[] = [];
      for (let i = 1; i <= columns.length; i++) {
        const value = row.getCell(i).value;
        if (value !== null && typeof value !== "string" && typeof value !== "number")
          throw new AppError(400, "Fórmulas, links e células complexas não são permitidos.");
        cells.push(String(value ?? "").trim());
      }
      matrix.push(cells);
    });
  } else throw new AppError(400, "Envie somente CSV ou XLSX. SQL não é permitido.");
  if (matrix.length < 2 || matrix.length > MAX_ROWS + 1)
    throw new AppError(400, "Informe de 1 a 500 usuários.");
  if (matrix[0].join(",") !== columns.join(","))
    throw new AppError(400, "Colunas inválidas. Use o template, sem coluna de senha.");
  return matrix.slice(1).map((row) => {
    if (row.length !== columns.length) throw new AppError(400, "Quantidade de colunas inválida.");
    return Object.fromEntries(columns.map((column, i) => [column, String(row[i] ?? "").trim()]));
  });
}
export async function validateRows(
  rows: RawRow[],
  tx: Prisma.TransactionClient = prisma,
): Promise<ReviewRow[]> {
  const [units, categories, existing] = await Promise.all([
    tx.unit.findMany({ where: { active: true } }),
    tx.professionalCategory.findMany({ where: { active: true } }),
    tx.user.findMany({
      select: { email: true, registrationNumber: true, functionalIdentifier: true },
    }),
  ]);
  const seen = new Set<string>();
  return rows.map((row, i) => {
    row = { ...row, cpf_ou_identificador: normalizeIdentifier(row.cpf_ou_identificador) };
    const errors: string[] = [];
    if (Object.values(row).some((value) => /^[=+@\-\t\r]/.test(value)))
      errors.push("Conteúdo de fórmula não permitido.");
    if (!validIdentifier(row.cpf_ou_identificador))
      errors.push("CPF estruturalmente inválido ou identificador inválido.");
    const unit = units.find((u) => u.code === row.unidade),
      category = categories.find((c) => c.name === row.categoria);
    if (!unit) errors.push("Unidade inexistente ou inativa (use o código).");
    if (!category) errors.push("Categoria inexistente ou inativa.");
    const parsed = userInputSchema.safeParse({
      name: row.nome,
      email: row.email,
      registrationNumber: row.matricula,
      functionalIdentifier: row.cpf_ou_identificador,
      accessProfile: row.perfil,
      professionalCategoryId: category?.id ?? "",
      primaryUnitId: unit?.id ?? "",
      status: row.status,
    });
    if (!parsed.success)
      errors.push(
        ...parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
      );
    const keys = [
      `email:${row.email.toLowerCase()}`,
      `registration:${row.matricula}`,
      ...(row.cpf_ou_identificador ? [`identifier:${row.cpf_ou_identificador}`] : []),
    ];
    const duplicate =
      keys.some((key) => seen.has(key)) ||
      existing.some(
        (u) =>
          u.email === row.email.toLowerCase() ||
          u.registrationNumber === row.matricula ||
          (!!row.cpf_ou_identificador && u.functionalIdentifier === row.cpf_ou_identificador),
      );
    keys.forEach((key) => seen.add(key));
    if (duplicate) errors.push("Duplicidade no arquivo ou no banco.");
    return {
      line: i + 2,
      data: row,
      errors,
      duplicate,
      ...(parsed.success ? { input: parsed.data } : {}),
    };
  });
}
export async function previewImport(actor: SafeUser, name: string, buffer: Buffer) {
  assertPermission(actor, "users:manage");
  const rows = await parseFile(name, buffer),
    review = await validateRows(rows);
  const batch = await prisma.userImportBatch.create({
    data: {
      actorUserId: actor.id,
      rows: rows as Prisma.InputJsonValue,
      total: rows.length,
      expiresAt: new Date(Date.now() + IMPORT_PREVIEW_TTL_MS),
    },
  });
  return {
    id: batch.id,
    rows: review,
    total: review.length,
    valid: review.filter((r) => !r.errors.length).length,
    invalid: review.filter((r) => r.errors.length).length,
    duplicates: review.filter((r) => r.duplicate).length,
  };
}
export async function confirmImport(actor: SafeUser, id: string) {
  assertPermission(actor, "users:manage");
  // Hash outside the database transaction; credentials are only returned on successful commit.
  const batch = await prisma.userImportBatch.findUnique({ where: { id } });
  if (
    !batch ||
    batch.actorUserId !== actor.id ||
    batch.status !== "PREVIEW" ||
    batch.expiresAt <= new Date()
  )
    throw new AppError(409, "Prévia indisponível ou expirada.");
  const rows = batch.rows as RawRow[];
  const credentials: { email: string; password: string; passwordHash: string }[] = [];
  for (const row of rows) {
    const password = temporaryPassword();
    credentials.push({ email: row.email, password, passwordHash: await hashPassword(password) });
  }
  return prisma.$transaction(
    async (tx) => {
      await freshActor(tx, actor);
      const claimed = await tx.userImportBatch.updateMany({
        where: { id, actorUserId: actor.id, status: "PREVIEW", expiresAt: { gt: new Date() } },
        data: { status: "CONFIRMED", confirmedAt: new Date() },
      });
      if (claimed.count !== 1) throw new AppError(409, "Esta prévia já foi confirmada ou expirou.");
      const review = await validateRows(rows, tx);
      if (review.some((r) => r.errors.length))
        throw new AppError(409, "Existem erros ou duplicidades. Envie uma nova prévia corrigida.");
      for (const [i, row] of review.entries()) {
        const data = row.input!;
        await validateReferences(tx, data);
        const user = await tx.user.create({
          data: { ...data, passwordHash: credentials[i].passwordHash, mustChangePassword: true },
        });
        await audit(tx, actor.id, "USER_CREATED", "User", user.id, undefined, userSnapshot(user));
      }
      await tx.userImportBatch.update({ where: { id }, data: { rows: [] } });
      await audit(tx, actor.id, "USERS_IMPORTED", "UserImportBatch", id, undefined, {
        total: rows.length,
      });
      return credentials.map((c) => ({ email: c.email, temporaryPassword: c.password }));
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30000 },
  );
}
