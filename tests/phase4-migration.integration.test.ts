import { it, expect } from "vitest";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
// pg is already the project's database verification dependency.
const { Client } = createRequire(import.meta.url)("pg") as {
  Client: new (options: { connectionString: string }) => {
    connect(): Promise<void>;
    end(): Promise<void>;
    query(sql: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
  };
};
it("Fase 4 migra base anterior preenchida sem alterar identidades, cancelados ou auditoria", async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL_TEST! });
  const schema = "f4_" + randomUUID().replaceAll("-", "");
  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET LOCAL search_path TO "${schema}"`);
    for (const folder of [
      "20261002140000_foundation",
      "20261019170000_reference_integrity",
      "20261020020000_attendances",
    ])
      await client.query(await readFile(`prisma/migrations/${folder}/migration.sql`, "utf8"));
    await client.query(`INSERT INTO "ProfessionalCategory" (id,name,"updatedAt") VALUES ('cat','Categoria Fictícia',now());
      INSERT INTO "Unit" (id,name,code,"updatedAt") VALUES ('unit','Unidade Fictícia','DEMO',now());
      INSERT INTO "User" (id,name,email,"passwordHash","registrationNumber","accessProfile","professionalCategoryId","primaryUnitId","updatedAt") VALUES ('user','Pessoa Fictícia','migration@exemplo.invalid','hash-ficticio','DEMO','INTERVIEWER','cat','unit',now());
      INSERT INTO "Attendance" (id,"ownerUserId","unitId","serviceDate",name,cpf,kind,opinion,"operatorName","operatorRegistration","operatorCategory","unitName","unitCode",timezone,"updatedAt","cancelledAt","cancellationReason") VALUES
      ('active','user','unit','2026-10-20','Pessoa Fictícia','00000000191','GUIDANCE','WITHOUT','Operador Fictício','DEMO','Categoria Fictícia','Unidade Fictícia','DEMO','America/Sao_Paulo',now(),NULL,NULL),
      ('cancelled','user','unit','2026-10-20','Pessoa Fictícia','00000000272','GUIDANCE','WITHOUT','Operador Fictício','DEMO','Categoria Fictícia','Unidade Fictícia','DEMO','America/Sao_Paulo',now(),now(),'Cancelamento fictício');
      INSERT INTO "AuditLog" (id,action,"entityType") VALUES ('audit','FIXTURE','Attendance');`);
    const before = (
      await client.query('SELECT to_jsonb(a) AS data FROM "Attendance" a ORDER BY id')
    ).rows;
    const audit = (await client.query('SELECT * FROM "AuditLog"')).rows;
    await client.query(
      await readFile(
        "prisma/migrations/20261023140000_indicators_configuration/migration.sql",
        "utf8",
      ),
    );
    expect(
      (
        await client.query(
          "SELECT to_jsonb(a) - 'kindName' AS data FROM \"Attendance\" a ORDER BY id",
        )
      ).rows,
    ).toEqual(before);
    expect((await client.query('SELECT * FROM "AuditLog"')).rows).toEqual(audit);
    expect((await client.query('SELECT count(*)::int AS n FROM "AttendanceType"')).rows[0].n).toBe(
      7,
    );
    expect(
      (await client.query('SELECT count(*)::int AS n FROM "AttendanceBenefit"')).rows[0].n,
    ).toBe(0);
    await client.query("SAVEPOINT guard");
    await expect(
      client.query("UPDATE \"Attendance\" SET name='Tentativa',version=2 WHERE id='cancelled'"),
    ).rejects.toBeDefined();
    await client.query("ROLLBACK TO SAVEPOINT guard");
    await client.query(`INSERT INTO "Attendance" (id,"ownerUserId","unitId","serviceDate",name,cpf,kind,opinion,"operatorName","operatorRegistration","operatorCategory","unitName","unitCode",timezone,"updatedAt")
      SELECT 'volume-'||n,'user','unit',DATE '2026-01-01'+(n%365),'Pessoa Fictícia','00000000191','GUIDANCE','WITHOUT','Operador Fictício','DEMO','Categoria Fictícia','Unidade Fictícia','DEMO','America/Sao_Paulo',now() FROM generate_series(1,8000) n`);
    await client.query('ANALYZE "Attendance"');
    const plans = [];
    for (const query of [
      `SELECT count(*) FILTER (WHERE "cancelledAt" IS NULL) FROM "Attendance" WHERE "serviceDate" BETWEEN '2026-10-01' AND '2026-10-31'`,
      `SELECT count(*) FROM "Attendance" WHERE "ownerUserId"='user' AND "serviceDate" BETWEEN '2026-10-01' AND '2026-10-31'`,
      `SELECT "ownerUserId",cpf,"serviceDate",count(*) FROM "Attendance" WHERE "serviceDate" BETWEEN '2026-10-01' AND '2026-10-31' AND "cancelledAt" IS NULL GROUP BY "ownerUserId",cpf,"serviceDate" HAVING count(*)>1`,
    ]) {
      const plan = await client.query("EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) " + query);
      expect(plan.rows).toHaveLength(1);
      plans.push({ query, plan: plan.rows });
    }
    expect((await client.query('SELECT count(*)::int AS n FROM "Attendance"')).rows[0].n).toBe(
      8002,
    );
    await mkdir(".local/evidence", { recursive: true });
    await writeFile(
      ".local/evidence/phase-4-query-plans.json",
      JSON.stringify({ rows: 8002, plans }, null, 2),
    );
  } finally {
    // Everything, including the temporary schema, belongs to this rolled-back test transaction.
    await client.query("ROLLBACK");
    await client.end();
  }
});
