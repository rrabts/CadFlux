ALTER TABLE "User" ADD COLUMN "operationalUnitId" TEXT;
ALTER TABLE "User" ADD CONSTRAINT "User_operationalUnitId_fkey" FOREIGN KEY ("operationalUnitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- NULL on existing records means the original fixed label (never the renamed catalog label).
-- No UPDATE of historic/cancelled attendances or disabling of their protection triggers.
ALTER TABLE "Attendance" ADD COLUMN "kindName" TEXT;
CREATE TABLE "Benefit" (
  "id" TEXT PRIMARY KEY, "name" TEXT NOT NULL, "active" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 1 CHECK ("version" > 0),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CHECK (length(btrim("name")) BETWEEN 2 AND 120)
);
CREATE UNIQUE INDEX "Benefit_name_lower_key" ON "Benefit" (lower("name"));
CREATE TABLE "AttendanceType" (
  "code" "AttendanceKind" PRIMARY KEY, "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true, "version" INTEGER NOT NULL DEFAULT 1 CHECK ("version" > 0),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CHECK (length(btrim("name")) BETWEEN 2 AND 120)
);
CREATE UNIQUE INDEX "AttendanceType_name_lower_key" ON "AttendanceType" (lower("name"));
INSERT INTO "AttendanceType" ("code", "name", "updatedAt") VALUES
('UPDATE_SINGLE','Atualização Unipessoal',CURRENT_TIMESTAMP),
('UPDATE_FAMILY','Atualização Familiar',CURRENT_TIMESTAMP),
('INCLUDE_FAMILY','Inclusão Familiar',CURRENT_TIMESTAMP),
('INCLUDE_SINGLE_BF','Inclusão Unipessoal Bolsa Família',CURRENT_TIMESTAMP),
('INCLUDE_SINGLE_BPC','Inclusão Unipessoal BPC',CURRENT_TIMESTAMP),
('VERIFICATION','Averiguação Cadastral',CURRENT_TIMESTAMP),
('GUIDANCE','Orientação',CURRENT_TIMESTAMP);
CREATE TABLE "AttendanceBenefit" (
  "attendanceId" TEXT NOT NULL REFERENCES "Attendance"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "benefitId" TEXT NOT NULL REFERENCES "Benefit"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "name" TEXT NOT NULL,
  PRIMARY KEY ("attendanceId", "benefitId")
);
CREATE TRIGGER benefit_no_delete BEFORE DELETE ON "Benefit" FOR EACH ROW EXECUTE FUNCTION cadflux_reject_identity_delete();
CREATE TRIGGER benefit_no_truncate BEFORE TRUNCATE ON "Benefit" FOR EACH STATEMENT EXECUTE FUNCTION cadflux_reject_identity_delete();
CREATE TRIGGER attendance_type_no_delete BEFORE DELETE ON "AttendanceType" FOR EACH ROW EXECUTE FUNCTION cadflux_reject_identity_delete();
CREATE TRIGGER attendance_type_no_truncate BEFORE TRUNCATE ON "AttendanceType" FOR EACH STATEMENT EXECUTE FUNCTION cadflux_reject_identity_delete();
CREATE FUNCTION cadflux_reset_operational_unit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."primaryUnitId" IS DISTINCT FROM OLD."primaryUnitId" THEN
    NEW."operationalUnitId" := NULL;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER user_reset_operational_unit BEFORE UPDATE ON "User" FOR EACH ROW EXECUTE FUNCTION cadflux_reset_operational_unit();
