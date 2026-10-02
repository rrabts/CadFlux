import { inflateRawSync } from "node:zlib";
import { parse } from "csv-parse/sync";
import ExcelJS from "exceljs";
import { AppError } from "@/lib/errors";
import {
  IMPORT_COLUMNS,
  MAX_IMPORT_BYTES,
  MAX_IMPORT_ROWS,
  type ImportRawData,
  type ParsedImportRow,
} from "./types";

const MAX_EXPANDED_BYTES = 16 * 1024 * 1024;
const MAX_ENTRY_BYTES = 4 * 1024 * 1024;
const allowedEntry =
  /^(?:\[Content_Types\]\.xml|_rels\/\.rels|docProps\/(?:app|core)\.xml|xl\/(?:workbook\.xml|styles\.xml|sharedStrings\.xml|_rels\/workbook\.xml\.rels|theme\/theme\d+\.xml|worksheets\/sheet\d+\.xml|worksheets\/_rels\/sheet\d+\.xml\.rels))$/;

export function sanitizeImportFileName(name: string): string {
  return (name.split(/[\\/]/).at(-1) || "arquivo")
    .replace(/[^\p{L}\p{N}_. -]/gu, "_")
    .slice(0, 120);
}

function invalidFormat(): never {
  throw new AppError(
    400,
    "Arquivo inválido. Utilize somente um CSV UTF-8 ou XLSX com o modelo de usuários.",
  );
}

function crc32(bytes: Uint8Array): number {
  let crc = -1;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ -1) >>> 0;
}

/** Bound inflation before ExcelJS can allocate workbook structures. */
export function validateXlsxArchive(input: Uint8Array): void {
  const bytes = Buffer.from(input);
  let end = -1;
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65557); offset--) {
    if (
      bytes.readUInt32LE(offset) === 0x06054b50 &&
      offset + 22 + bytes.readUInt16LE(offset + 20) === bytes.length
    ) {
      end = offset;
      break;
    }
  }
  if (end < 0 || bytes.readUInt16LE(end + 4) || bytes.readUInt16LE(end + 6)) invalidFormat();
  const count = bytes.readUInt16LE(end + 10);
  const centralSize = bytes.readUInt32LE(end + 12);
  const centralOffset = bytes.readUInt32LE(end + 16);
  if (
    !count ||
    count > 128 ||
    bytes.readUInt16LE(end + 8) !== count ||
    centralOffset + centralSize !== end
  )
    invalidFormat();
  const names = new Set<string>();
  const ranges: { start: number; end: number }[] = [];
  let position = centralOffset;
  let expanded = 0;
  for (let index = 0; index < count; index++) {
    if (position + 46 > end || bytes.readUInt32LE(position) !== 0x02014b50) invalidFormat();
    const flags = bytes.readUInt16LE(position + 8);
    const method = bytes.readUInt16LE(position + 10);
    const checksum = bytes.readUInt32LE(position + 16);
    const compressedSize = bytes.readUInt32LE(position + 20);
    const originalSize = bytes.readUInt32LE(position + 24);
    const nameSize = bytes.readUInt16LE(position + 28);
    const extraSize = bytes.readUInt16LE(position + 30);
    const commentSize = bytes.readUInt16LE(position + 32);
    const localOffset = bytes.readUInt32LE(position + 42);
    const next = position + 46 + nameSize + extraSize + commentSize;
    if (
      next > end ||
      bytes.readUInt16LE(position + 34) ||
      flags & ~0x080e ||
      ![0, 8].includes(method)
    )
      invalidFormat();
    const name = bytes.subarray(position + 46, position + 46 + nameSize).toString("utf8");
    if (
      names.has(name) ||
      name.includes("\\") ||
      name.split("/").includes("..") ||
      (!name.endsWith("/") && !allowedEntry.test(name))
    )
      invalidFormat();
    names.add(name);
    if (
      originalSize > MAX_ENTRY_BYTES ||
      expanded + originalSize > MAX_EXPANDED_BYTES ||
      originalSize > Math.max(1024, compressedSize * 200)
    ) {
      throw new AppError(400, "XLSX excede os limites seguros de descompactação.");
    }
    if (localOffset + 30 > centralOffset || bytes.readUInt32LE(localOffset) !== 0x04034b50)
      invalidFormat();
    const localNameSize = bytes.readUInt16LE(localOffset + 26);
    const localExtraSize = bytes.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameSize + localExtraSize;
    const dataEnd = dataStart + compressedSize;
    if (
      dataEnd > centralOffset ||
      bytes.readUInt16LE(localOffset + 6) !== flags ||
      bytes.readUInt16LE(localOffset + 8) !== method ||
      bytes.subarray(localOffset + 30, localOffset + 30 + localNameSize).toString("utf8") !== name
    )
      invalidFormat();
    if (
      !(flags & 8) &&
      (bytes.readUInt32LE(localOffset + 14) !== checksum ||
        bytes.readUInt32LE(localOffset + 18) !== compressedSize ||
        bytes.readUInt32LE(localOffset + 22) !== originalSize)
    )
      invalidFormat();
    ranges.push({ start: localOffset, end: dataEnd });
    let content: Buffer;
    try {
      const compressed = bytes.subarray(dataStart, dataEnd);
      content =
        method === 0
          ? compressed
          : inflateRawSync(compressed, {
              maxOutputLength: Math.max(1, Math.min(originalSize, MAX_ENTRY_BYTES)),
            });
    } catch {
      throw new AppError(400, "XLSX inválido ou excede os limites seguros de descompactação.");
    }
    if (content.length !== originalSize || crc32(content) !== checksum) invalidFormat();
    expanded += content.length;
    const xml = content.toString("utf8");
    if (/<!DOCTYPE|<!ENTITY|TargetMode\s*=\s*["']External["']/i.test(xml)) {
      throw new AppError(400, "XLSX contém links externos ou conteúdo não permitido.");
    }
    if (/<(?:\w+:)?f(?:\s|>|\/)/i.test(xml))
      throw new AppError(400, "Remova todas as fórmulas do XLSX antes de importar.");
    if (/^xl\/worksheets\/sheet\d+\.xml$/.test(name)) {
      const rowTags = [...xml.matchAll(/<(?:\w+:)?row\b[^>]*>/g)];
      if (
        rowTags.length > MAX_IMPORT_ROWS + 1 ||
        rowTags.some(([tag]) => {
          const rowNumber = /\br\s*=\s*["'](\d+)["']/.exec(tag)?.[1];
          return rowNumber && Number(rowNumber) > MAX_IMPORT_ROWS + 1;
        })
      )
        throw new AppError(400, `O arquivo pode conter no máximo ${MAX_IMPORT_ROWS} usuários.`);
      const cellTags = [...xml.matchAll(/<(?:\w+:)?c\b[^>]*>/g)];
      if (
        cellTags.length > (MAX_IMPORT_ROWS + 1) * IMPORT_COLUMNS.length ||
        cellTags.some(([tag]) => {
          const address = /\br\s*=\s*["']([A-Z]+)(\d+)["']/.exec(tag);
          return (
            !address || !/^[A-H]$/.test(address[1]) || Number(address[2]) > MAX_IMPORT_ROWS + 1
          );
        })
      )
        invalidFormat();
      if (/<(?:\w+:)?mergeCell\b/.test(xml))
        throw new AppError(400, "Remova as células mescladas antes de importar.");
      if (
        [...xml.matchAll(/<(?:\w+:)?col\b[^>]*>/g)].some(([tag]) => {
          const min = /\bmin\s*=\s*["'](\d+)["']/.exec(tag)?.[1];
          const max = /\bmax\s*=\s*["'](\d+)["']/.exec(tag)?.[1];
          return (
            !min ||
            !max ||
            Number(min) < 1 ||
            Number(max) > IMPORT_COLUMNS.length ||
            Number(min) > Number(max)
          );
        })
      )
        invalidFormat();
    }
    position = next;
  }
  if (
    position !== end ||
    !names.has("[Content_Types].xml") ||
    !names.has("xl/workbook.xml") ||
    !names.has("xl/worksheets/sheet1.xml")
  )
    invalidFormat();
  ranges.sort((left, right) => left.start - right.start);
  if (ranges.some((range, index) => index > 0 && range.start < ranges[index - 1].end))
    invalidFormat();
}

function validateHeaders(headers: string[]): void {
  if (
    headers.length !== IMPORT_COLUMNS.length ||
    headers.some((header, index) => header.trim().toLowerCase() !== IMPORT_COLUMNS[index])
  ) {
    throw new AppError(
      400,
      `Utilize as colunas do modelo, nesta ordem: ${IMPORT_COLUMNS.join(", ")}. Não inclua senhas.`,
    );
  }
}

function rowFromCells(cells: string[], line: number, errors: string[] = []): ParsedImportRow {
  const values = Object.fromEntries(
    IMPORT_COLUMNS.map((column, index) => [column, (cells[index] || "").trim()]),
  ) as ImportRawData;
  for (const column of IMPORT_COLUMNS) {
    const value = values[column];
    if (value.length > 500) errors.push(`${column}: texto excede o limite de 500 caracteres.`);
    if (/^[=+\-@]/.test(value) || /^[\t\r]/.test(cells[IMPORT_COLUMNS.indexOf(column)] || ""))
      errors.push(`${column}: fórmula ou conteúdo executável não permitido.`);
    if (/[\u0000-\u001f\u007f]/.test(value))
      errors.push(`${column}: caractere de controle não permitido.`);
  }
  return { line, values, errors };
}

function parseCsv(bytes: Uint8Array): ParsedImportRow[] {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^\uFEFF/, "");
  } catch {
    invalidFormat();
  }
  if (text.includes("\0") || /^\s*(?:PK|<html|<!doctype|<\?xml)/i.test(text)) invalidFormat();
  const header = text.split(/\r\n|\r|\n/, 1)[0];
  const delimiter = header.includes(";") ? ";" : ",";
  let records: { record: string[]; info: { lines: number } }[];
  try {
    records = parse(text, {
      bom: true,
      delimiter,
      skip_empty_lines: true,
      info: true,
      max_record_size: 8192,
      to: MAX_IMPORT_ROWS + 2,
    }) as unknown as { record: string[]; info: { lines: number } }[];
  } catch {
    throw new AppError(400, "CSV inválido. Confira separadores, aspas e a codificação UTF-8.");
  }
  if (!records.length) invalidFormat();
  validateHeaders(records[0].record);
  if (records.length > MAX_IMPORT_ROWS + 1)
    throw new AppError(400, `O arquivo pode conter no máximo ${MAX_IMPORT_ROWS} usuários.`);
  return records.slice(1).map(({ record, info }) => rowFromCells(record, info.lines));
}

async function parseXlsx(bytes: Uint8Array): Promise<ParsedImportRow[]> {
  validateXlsxArchive(bytes);
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(bytes as unknown as ExcelJS.Buffer);
  } catch {
    invalidFormat();
  }
  if (workbook.worksheets.length !== 1)
    throw new AppError(400, "O XLSX deve conter uma única planilha de usuários.");
  const sheet = workbook.worksheets[0];
  if (sheet.rowCount > MAX_IMPORT_ROWS + 1)
    throw new AppError(400, `O arquivo pode conter no máximo ${MAX_IMPORT_ROWS} usuários.`);
  if (sheet.columnCount !== IMPORT_COLUMNS.length) invalidFormat();
  const headers = IMPORT_COLUMNS.map((_, index) => String(sheet.getCell(1, index + 1).value || ""));
  validateHeaders(headers);
  const rows: ParsedImportRow[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, line) => {
    if (line === 1) return;
    const errors: string[] = [];
    const cells = IMPORT_COLUMNS.map((column, index) => {
      const cell = row.getCell(index + 1);
      const value = cell.value;
      if (value === null || value === undefined) return "";
      if (typeof value === "string") return value;
      errors.push(
        `${column}: utilize somente texto simples; fórmulas, números e links não são permitidos.`,
      );
      return "";
    });
    rows.push(rowFromCells(cells, line, errors));
  });
  return rows;
}

export async function parseImportFile(
  bytes: Uint8Array,
  fileName: string,
): Promise<ParsedImportRow[]> {
  if (!bytes.length || bytes.length > MAX_IMPORT_BYTES)
    throw new AppError(400, "Selecione um arquivo não vazio de até 2 MiB.");
  const extension = fileName.split(".").at(-1)?.toLowerCase();
  const rows =
    extension === "csv"
      ? parseCsv(bytes)
      : extension === "xlsx"
        ? await parseXlsx(bytes)
        : invalidFormat();
  if (!rows.length) throw new AppError(400, "O arquivo não contém usuários para importar.");
  return rows;
}

export async function createImportTemplate(format: "csv" | "xlsx"): Promise<Buffer> {
  if (format === "csv") return Buffer.from(`\uFEFF${IMPORT_COLUMNS.join(",")}\r\n`, "utf8");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "CadFlux";
  const sheet = workbook.addWorksheet("Usuários", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = IMPORT_COLUMNS.map((column) => ({
    header: column,
    key: column,
    width: column === "nome" || column === "email" ? 32 : 24,
    style: { numFmt: "@" },
  }));
  sheet.getRow(1).font = { bold: true, color: { argb: "FF12304A" } };
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
