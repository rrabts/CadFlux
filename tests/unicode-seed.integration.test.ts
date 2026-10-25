import { afterAll, expect, it } from "vitest";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { prisma } from "@/lib/db";
import { ensureDemoCategories } from "../prisma/demo-categories";

const { Client } = createRequire(import.meta.url)("pg") as {
  Client: new (options: { connectionString: string }) => {
    connect(): Promise<void>;
    end(): Promise<void>;
    query(sql: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
  };
};
type Client = InstanceType<typeof Client>;
const unicodeMigration = async () =>
  // The test owns the surrounding rollback; execute the exact migration body.
  (await readFile("prisma/migrations/20261024120000_unicode_names/migration.sql", "utf8"))
    .replace(/^BEGIN;\s*/m, "")
    .replace(/COMMIT;\s*$/, "");

async function previousSchema(run: (client: Client) => Promise<void>) {
  const client = new Client({ connectionString: process.env.DATABASE_URL_TEST! });
  const schema = "unicode_" + randomUUID().replaceAll("-", "");
  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET LOCAL search_path TO "${schema}"`);
    for (const folder of [
      "20261002140000_foundation",
      "20261019170000_reference_integrity",
      "20261020020000_attendances",
      "20261023140000_indicators_configuration",
    ]) {
      await client.query(await readFile(`prisma/migrations/${folder}/migration.sql`, "utf8"));
    }
    // Exercise a preexisting C-locale schema even when CI uses another locale.
    for (const table of ["ProfessionalCategory", "Benefit", "AttendanceType"])
      await client.query(`ALTER TABLE "${table}" ALTER COLUMN name TYPE text COLLATE "C"`);
    await run(client);
  } finally {
    await client.query("ROLLBACK");
    await client.end();
  }
}

afterAll(() => prisma.$disconnect());

it("D06 migra nomes acentuados sem reescrever cadastros ou auditoria, com busca e unicidade Unicode", async () => {
  await previousSchema(async (client) => {
    await client.query(`
      INSERT INTO "ProfessionalCategory" (id,name,"updatedAt") VALUES ('cat','Categoria Fictícia',now());
      INSERT INTO "Benefit" (id,name,"updatedAt") VALUES ('benefit','Benefício Fictício',now());
      INSERT INTO "AuditLog" (id,action,"entityType") VALUES ('audit','FIXTURE','Review');
    `);
    async function snapshot() {
      const rows = [];
      for (const table of ["ProfessionalCategory", "Benefit", "AttendanceType", "AuditLog"])
        rows.push(
          (await client.query(`SELECT to_jsonb(t) AS data FROM "${table}" t ORDER BY 1`)).rows,
        );
      return rows;
    }
    const before = await snapshot();
    await client.query(await unicodeMigration());
    expect(await snapshot()).toEqual(before);
    for (const [table, idColumn, id, uppercase] of [
      ["ProfessionalCategory", "id", "cat", "CATEGORIA FICTÍCIA"],
      ["Benefit", "id", "benefit", "BENEFÍCIO FICTÍCIO"],
      ["AttendanceType", "code", "GUIDANCE", "ORIENTAÇÃO"],
    ]) {
      const found = await client.query(`SELECT "${idColumn}" FROM "${table}" WHERE name ILIKE $1`, [
        uppercase,
      ]);
      expect(found.rows).toEqual([{ [idColumn]: id }]);
    }
    for (const statement of [
      `INSERT INTO "ProfessionalCategory" (id,name,"updatedAt") VALUES ('duplicate','CATEGORIA FICTÍCIA',now())`,
      `INSERT INTO "Benefit" (id,name,"updatedAt") VALUES ('duplicate','BENEFÍCIO FICTÍCIO',now())`,
      `UPDATE "AttendanceType" SET name='ORIENTAÇÃO' WHERE code='VERIFICATION'`,
    ]) {
      await client.query("SAVEPOINT duplicate");
      await expect(client.query(statement)).rejects.toMatchObject({ code: "23505" });
      await client.query("ROLLBACK TO SAVEPOINT duplicate");
    }
  });
});

it.each(["ProfessionalCategory", "Benefit", "AttendanceType"])(
  "D06 recusa colisões anteriores em %s sem apagar, mesclar ou modificar os dados",
  async (table) => {
    await previousSchema(async (client) => {
      if (table === "AttendanceType") {
        await client.query(`UPDATE "AttendanceType" SET name='Fictícia' WHERE code='GUIDANCE';
          UPDATE "AttendanceType" SET name='FICTÍCIA' WHERE code='VERIFICATION'`);
      } else {
        await client.query(`INSERT INTO "${table}" (id,name,"updatedAt") VALUES
          ('one','Fictícia',now()),('two','FICTÍCIA',now())`);
      }
      const before = (await client.query(`SELECT to_jsonb(t) AS data FROM "${table}" t ORDER BY 1`))
        .rows;
      await client.query("SAVEPOINT migration_attempt");
      await expect(client.query(await unicodeMigration())).rejects.toMatchObject({
        code: "23505",
        message: expect.stringContaining(`Unicode name conflict in ${table}`),
      });
      await client.query("ROLLBACK TO SAVEPOINT migration_attempt");
      expect(
        (await client.query(`SELECT to_jsonb(t) AS data FROM "${table}" t ORDER BY 1`)).rows,
      ).toEqual(before);
    });
  },
);

it("D05 seed reutiliza categorias renomeadas por caixa e preserva IDs, nomes e estado", async () => {
  const rollback = new Error("rollback da fixture fictícia");
  await expect(
    prisma.$transaction(async (tx) => {
      const original = await ensureDemoCategories(tx);
      const renamed = await tx.professionalCategory.update({
        where: { id: original[0].id },
        data: { name: "ENTREVISTADOR", active: false },
      });
      const accented = await tx.professionalCategory.update({
        where: { id: original[2].id },
        data: { name: "COORDENAÇÃO" },
      });
      const count = await tx.professionalCategory.count();
      for (let attempt = 0; attempt < 2; attempt++) {
        const categories = await ensureDemoCategories(tx);
        expect(categories[0]).toEqual(renamed);
        expect(categories[2]).toEqual(accented);
        expect(categories.map((category) => category.id)).toEqual(
          original.map((category) => category.id),
        );
        expect(await tx.professionalCategory.count()).toBe(count);
      }
      throw rollback;
    }),
  ).rejects.toBe(rollback);
});
