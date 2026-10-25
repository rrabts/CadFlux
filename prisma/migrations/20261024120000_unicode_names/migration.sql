-- Use PostgreSQL's built-in UTF-8 case mapping independently of the database's
-- OS locale (including existing clusters initialized with --locale=C).
-- Names and historical data are never rewritten or merged by this migration.
BEGIN;

LOCK TABLE "ProfessionalCategory", "Benefit", "AttendanceType" IN ACCESS EXCLUSIVE MODE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "ProfessionalCategory"
    GROUP BY lower(btrim("name" COLLATE pg_catalog.pg_c_utf8)) HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Unicode name conflict in ProfessionalCategory; resolve duplicates explicitly before migration'
      USING ERRCODE = '23505';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "Benefit"
    GROUP BY lower("name" COLLATE pg_catalog.pg_c_utf8) HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Unicode name conflict in Benefit; resolve duplicates explicitly before migration'
      USING ERRCODE = '23505';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "AttendanceType"
    GROUP BY lower("name" COLLATE pg_catalog.pg_c_utf8) HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Unicode name conflict in AttendanceType; resolve duplicates explicitly before migration'
      USING ERRCODE = '23505';
  END IF;
END;
$$;

DROP INDEX "ProfessionalCategory_name_ci_key";
DROP INDEX "Benefit_name_lower_key";
DROP INDEX "AttendanceType_name_lower_key";

-- The column collation also applies to Prisma's ILIKE queries, not just indexes.
ALTER TABLE "ProfessionalCategory" ALTER COLUMN "name" TYPE TEXT COLLATE pg_catalog.pg_c_utf8;
ALTER TABLE "Benefit" ALTER COLUMN "name" TYPE TEXT COLLATE pg_catalog.pg_c_utf8;
ALTER TABLE "AttendanceType" ALTER COLUMN "name" TYPE TEXT COLLATE pg_catalog.pg_c_utf8;

CREATE UNIQUE INDEX "ProfessionalCategory_name_ci_key" ON "ProfessionalCategory" (lower(btrim("name")));
CREATE UNIQUE INDEX "Benefit_name_lower_key" ON "Benefit" (lower("name"));
CREATE UNIQUE INDEX "AttendanceType_name_lower_key" ON "AttendanceType" (lower("name"));

COMMIT;
