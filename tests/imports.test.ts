import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { zipSync } from "fflate";
import {
  parseImportFile,
  createImportTemplate,
  sanitizeImportFileName,
} from "@/modules/imports/parser";
import { validateImportRows } from "@/modules/imports/validation";
import { readBoundedBody } from "@/modules/imports/request";
import {
  IMPORT_COLUMNS,
  MAX_IMPORT_BYTES,
  MAX_IMPORT_ROWS,
  type ImportReferences,
  type ImportRawData,
  type ParsedImportRow,
} from "@/modules/imports/types";

const values: ImportRawData = {
  nome: "Pessoa Fictícia",
  cpf_ou_identificador: "FUNC-001",
  email: "pessoa@exemplo.invalid",
  matricula: "DEMO-001",
  perfil: "INTERVIEWER",
  categoria: "Entrevistador",
  unidade: "DEMO",
  status: "ACTIVE",
};
const refs: ImportReferences = {
  categories: [{ id: "category-demo", name: "Entrevistador", active: true }],
  units: [{ id: "unit-demo", name: "Unidade Fictícia", code: "DEMO", active: true }],
  existingUsers: [],
};
const csv = (rows: ImportRawData[] = [values], delimiter = ",") =>
  Buffer.from(
    `${IMPORT_COLUMNS.join(delimiter)}\n${rows.map((row) => IMPORT_COLUMNS.map((column) => row[column]).join(delimiter)).join("\n")}`,
    "utf8",
  );
const raw = (changes: Partial<ImportRawData> = {}): ParsedImportRow => ({
  line: 2,
  values: { ...values, ...changes },
  errors: [],
});
async function xlsx(row: ImportRawData = values, extra?: (sheet: ExcelJS.Worksheet) => void) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Usuários");
  sheet.addRow([...IMPORT_COLUMNS]);
  sheet.addRow(IMPORT_COLUMNS.map((column) => row[column]));
  extra?.(sheet);
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}

describe("importação: formatos e processamento limitado", () => {
  it("lê CSV UTF-8 e mantém identificador como texto", async () => {
    const parsed = await parseImportFile(csv(), "usuarios.csv");
    expect(parsed).toEqual([raw()]);
  });
  it("aceita separador ponto e vírgula e BOM", async () => {
    const bytes = Buffer.concat([Buffer.from("\uFEFF"), csv([values], ";")]);
    expect((await parseImportFile(bytes, "usuarios.CSV"))[0].values).toEqual(values);
  });
  it("lê XLSX real com os campos como texto", async () => {
    expect(await parseImportFile(await xlsx(), "usuarios.xlsx")).toEqual([raw()]);
  });
  it("gera modelos CSV/XLSX com exatas colunas e nenhuma senha", async () => {
    const csvTemplate = await createImportTemplate("csv");
    expect(csvTemplate.toString()).toContain(IMPORT_COLUMNS.join(","));
    expect(csvTemplate.toString()).not.toMatch(/senha|password/i);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load((await createImportTemplate("xlsx")) as unknown as ExcelJS.Buffer);
    expect(workbook.worksheets).toHaveLength(1);
    expect(workbook.worksheets[0].getRow(1).values).toEqual([undefined, ...IMPORT_COLUMNS]);
  });
  it.each(["usuarios.sql", "usuarios.xls", "usuarios.json", "usuarios.exe"])(
    "recusa %s",
    async (name) => {
      await expect(parseImportFile(csv(), name)).rejects.toThrow(/CSV.*XLSX/);
    },
  );
  it("recusa conteúdo binário/XML/HTML disfarçado de CSV e UTF-8 inválido", async () => {
    for (const bytes of [
      Buffer.from("PK\0\0"),
      Buffer.from("<html>arquivo</html>"),
      Buffer.from([0xff, 0xfe]),
    ]) {
      await expect(parseImportFile(bytes, "usuarios.csv")).rejects.toThrow();
    }
  });
  it("recusa conteúdo CSV disfarçado de XLSX", async () => {
    await expect(parseImportFile(csv(), "usuarios.xlsx")).rejects.toThrow();
  });
  it("recusa arquivo vazio, modelo vazio e mais de 2 MiB", async () => {
    await expect(parseImportFile(new Uint8Array(), "usuarios.csv")).rejects.toThrow(/não vazio/);
    await expect(
      parseImportFile(await createImportTemplate("csv"), "usuarios.csv"),
    ).rejects.toThrow(/não contém usuários/);
    await expect(
      parseImportFile(new Uint8Array(MAX_IMPORT_BYTES + 1), "usuarios.csv"),
    ).rejects.toThrow(/2 MiB/);
  });
  it("recusa colunas extras incluindo senha e cabeçalhos fora do modelo", async () => {
    await expect(
      parseImportFile(
        Buffer.from(
          `${IMPORT_COLUMNS.join(",")},senha\n${IMPORT_COLUMNS.map((c) => values[c]).join(",")},segredo`,
        ),
        "usuarios.csv",
      ),
    ).rejects.toThrow(/Não inclua senhas/);
    await expect(
      parseImportFile(Buffer.from("nome,email\nPessoa,pessoa@exemplo.invalid"), "usuarios.csv"),
    ).rejects.toThrow(/colunas do modelo/);
  });
  it("limita linhas de CSV antes de processar todo o arquivo", async () => {
    await expect(
      parseImportFile(
        csv(Array.from({ length: MAX_IMPORT_ROWS + 1 }, () => values)),
        "usuarios.csv",
      ),
    ).rejects.toThrow(/1000/);
  });
  it("recusa XLSX com linha muito distante antes de carregar planilha", async () => {
    await expect(
      parseImportFile(
        await xlsx(values, (sheet) => {
          sheet.getCell("A1048576").value = "Pessoa";
        }),
        "usuarios.xlsx",
      ),
    ).rejects.toThrow(/1000/);
  });
  it("recusa XLSX com múltiplas planilhas", async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet("Uma");
    workbook.addWorksheet("Duas");
    await expect(
      parseImportFile(new Uint8Array(await workbook.xlsx.writeBuffer()), "usuarios.xlsx"),
    ).rejects.toThrow(/única planilha/);
  });
  it.each(["=HYPERLINK(1)", "+cmd", "-cmd", "@SUM(1)", "\tcmd"])(
    "sinaliza fórmula perigosa em CSV %s",
    async (content) => {
      const parsed = await parseImportFile(csv([{ ...values, nome: content }]), "usuarios.csv");
      expect(parsed[0].errors.join(" ")).toMatch(/fórmula|executável/);
    },
  );
  it("recusa fórmulas XLSX e links externos", async () => {
    await expect(
      parseImportFile(
        await xlsx(values, (sheet) => {
          sheet.getCell("A2").value = { formula: "SUM(1,1)", result: 2 };
        }),
        "usuarios.xlsx",
      ),
    ).rejects.toThrow(/fórmulas/);
    await expect(
      parseImportFile(
        await xlsx(values, (sheet) => {
          sheet.getCell("A2").value = { text: "Link", hyperlink: "https://exemplo.invalid" };
        }),
        "usuarios.xlsx",
      ),
    ).rejects.toThrow(/externos/);
  });
  it("sinaliza células numéricas para evitar perda de zeros dos identificadores", async () => {
    const parsed = await parseImportFile(
      await xlsx(values, (sheet) => {
        sheet.getCell("D2").value = 1;
      }),
      "usuarios.xlsx",
    );
    expect(parsed[0].errors.join(" ")).toMatch(/somente texto simples/);
  });
  it("recusa entradas inesperadas e ZIP bombs", async () => {
    const unexpected = zipSync({ "arquivo.exe": Buffer.from("não executar") });
    await expect(parseImportFile(unexpected, "usuarios.xlsx")).rejects.toThrow();
    const bomb = zipSync({ "xl/workbook.xml": new Uint8Array(5 * 1024 * 1024) }, { level: 9 });
    await expect(parseImportFile(bomb, "usuarios.xlsx")).rejects.toThrow(/descompactação/);
    const forged = Buffer.from(
      zipSync({ "xl/workbook.xml": new Uint8Array(200000) }, { level: 9 }),
    );
    const central = forged.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
    forged.writeUInt32LE(10, central + 24);
    forged.writeUInt32LE(10, 22);
    await expect(parseImportFile(forged, "usuarios.xlsx")).rejects.toThrow(/descompactação/);
  });
  it("recusa caminhos de arquivo perigosos e sanitiza nome apresentado", async () => {
    await expect(
      parseImportFile(zipSync({ "../xl/workbook.xml": Buffer.from("xml") }), "usuarios.xlsx"),
    ).rejects.toThrow();
    expect(sanitizeImportFileName("../../<script>.csv")).toBe("_script_.csv");
  });
  it("mantém o número físico da linha após linhas vazias", async () => {
    const bytes = Buffer.from(
      `${IMPORT_COLUMNS.join(",")}\r\n\r\n${IMPORT_COLUMNS.map((column) => values[column]).join(",")}\r\n`,
    );
    expect((await parseImportFile(bytes, "usuarios.csv"))[0].line).toBe(3);
  });
  it("recusa células mescladas e metadata ZIP divergente", async () => {
    await expect(
      parseImportFile(
        await xlsx(values, (sheet) => {
          sheet.mergeCells("A2:B2");
        }),
        "usuarios.xlsx",
      ),
    ).rejects.toThrow(/mescladas/);
    const bytes = Buffer.from(zipSync({ "xl/workbook.xml": Buffer.from("<workbook/>") }));
    bytes.writeUInt32LE(123, 14);
    await expect(parseImportFile(bytes, "usuarios.xlsx")).rejects.toThrow(/Arquivo inválido/);
  });
  it("limita o stream real mesmo sem content-length", async () => {
    const request = new Request("http://localhost", { method: "POST", body: "123456" });
    await expect(readBoundedBody(request, 5)).rejects.toMatchObject({ status: 413 });
    expect(
      await readBoundedBody(new Request("http://localhost", { method: "POST", body: "1234" }), 5),
    ).toEqual(new TextEncoder().encode("1234"));
  });
});

describe("importação: validação estrutural e referências", () => {
  it("resolve categoria/unidade ativas e normaliza identidades", () => {
    const [row] = validateImportRows(
      [
        raw({
          cpf_ou_identificador: "func-001",
          matricula: "demo-001",
          email: "PESSOA@exemplo.invalid",
        }),
      ],
      refs,
    );
    expect(row.errors).toEqual([]);
    expect(row.data).toMatchObject({
      functionalIdentifier: "FUNC-001",
      registrationNumber: "DEMO-001",
      email: "pessoa@exemplo.invalid",
      professionalCategoryId: "category-demo",
      primaryUnitId: "unit-demo",
    });
  });
  it.each([
    { nome: "" },
    { email: "inválido" },
    { matricula: "" },
    { perfil: "ADMIN" },
    { status: "OUTRO" },
  ])("recusa campos obrigatórios ou enum inválido %o", (changes) => {
    expect(validateImportRows([raw(changes)], refs)[0].errors.length).toBeGreaterThan(0);
  });
  it("recusa unidade inexistente e categoria inativa", () => {
    expect(validateImportRows([raw({ unidade: "inexistente" })], refs)[0].errors.join(" ")).toMatch(
      /Unidade inexistente/,
    );
    expect(
      validateImportRows([raw()], {
        ...refs,
        categories: [{ ...refs.categories[0], active: false }],
      })[0].errors.join(" "),
    ).toMatch(/Categoria inexistente, inativa/);
    expect(
      validateImportRows([raw()], {
        ...refs,
        units: [{ ...refs.units[0], active: false }],
      })[0].errors.join(" "),
    ).toMatch(/Unidade inexistente, inativa/);
  });
  it("recusa CPF inválido sem fazer consulta externa", () => {
    expect(
      validateImportRows([raw({ cpf_ou_identificador: "000.000.000-00" })], refs)[0].errors.join(
        " ",
      ),
    ).toMatch(/CPF estruturalmente inválido/);
  });
  it("sinaliza todas as duplicatas dentro do próprio arquivo", () => {
    const rows = validateImportRows(
      [
        raw(),
        {
          ...raw({
            email: "OUTRA@exemplo.invalid",
            matricula: "demo-001",
            cpf_ou_identificador: "func-001",
          }),
          line: 3,
        },
      ],
      refs,
    );
    expect(
      rows.every((row) => row.duplicate && row.errors.join(" ").includes("duplicado no arquivo")),
    ).toBe(true);
  });
  it("detecta duplicidade de e-mail, matrícula e identificador já existentes", () => {
    const rows = validateImportRows([raw()], {
      ...refs,
      existingUsers: [
        {
          email: "PESSOA@exemplo.invalid",
          registrationNumber: "DEMO-001",
          functionalIdentifier: "FUNC-001",
        },
      ],
    });
    expect(rows[0].duplicate).toBe(true);
    expect(rows[0].errors.join(" ")).toMatch(/já cadastrado no banco/);
  });
});
