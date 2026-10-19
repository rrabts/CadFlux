import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import pg from "pg";
import { loadDatabaseEnvironment, projectDirectory } from "./database-config.mjs";

// Read-only SQL verification of fresh, fictitious CI databases. No database reset.
const mode = process.argv[2];
const snapshotFile = resolve(projectDirectory, ".local/cloud-seed-digests.json");

try {
  assert.equal(process.env.CI, "true", "Esta verificação destina-se somente ao CI fictício.");
  assert.ok(["empty", "seeded", "unchanged"].includes(mode), "Use empty, seeded ou unchanged.");
  const { database, testDatabase } = loadDatabaseEnvironment();
  const digests = {};
  for (const target of [database, testDatabase]) {
    const client = new pg.Client({
      connectionString: target.value,
      connectionTimeoutMillis: 10_000,
      statement_timeout: 10_000,
    });
    try {
      await client.connect();
      const tables = await client.query(
        "SELECT count(*)::int AS total FROM pg_tables WHERE schemaname = 'public'",
      );
      assert.equal(tables.rows[0].total, mode === "empty" ? 0 : 11, "Total de tabelas inesperado.");
      if (mode === "empty") {
        console.log(`${target.name}: schema public vazio confirmado.`);
        continue;
      }
      const migration = await client.query(
        'SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name',
      );
      assert.deepEqual(migration.rows, [{ migration_name: "20261002140000_foundation" }]);
      const users = await client.query('SELECT * FROM "User" ORDER BY id');
      const units = await client.query('SELECT * FROM "Unit" ORDER BY id');
      const categories = await client.query('SELECT * FROM "ProfessionalCategory" ORDER BY id');
      assert.equal(users.rowCount, 3, "O seed precisa conter três usuários fictícios.");
      assert.equal(units.rowCount, 2, "O seed precisa conter duas unidades fictícias.");
      assert.equal(categories.rowCount, 4, "O seed precisa conter quatro categorias.");
      assert.deepEqual(
        users.rows.map((user) => user.accessProfile).sort(),
        ["DIRECTION", "INTERVIEWER", "REFERRAL_OPERATOR"],
      );
      assert.ok(users.rows.every((user) => user.status === "ACTIVE"));
      digests[target.name] = createHash("sha256")
        .update(JSON.stringify([users.rows, units.rows, categories.rows]))
        .digest("hex");
      console.log(`${target.name}: migration concluída; 3 usuários, 2 unidades, 4 categorias.`);
    } finally {
      await client.end();
    }
  }
  if (mode === "seeded") {
    await mkdir(resolve(projectDirectory, ".local"), { recursive: true });
    await writeFile(snapshotFile, JSON.stringify(digests), { mode: 0o600 });
  }
  if (mode === "unchanged") {
    assert.deepEqual(digests, JSON.parse(await readFile(snapshotFile, "utf8")));
    console.log("Setup repetido preservou integralmente usuários, unidades e categorias do seed.");
  }
} catch {
  // Driver/assertion errors may include credentials, hashes or row contents.
  console.error(`Verificação CI (${mode ?? "sem modo"}) falhou. Confira banco, migration e seed fictício.`);
  process.exitCode = 1;
}
