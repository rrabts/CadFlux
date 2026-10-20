CREATE TYPE "AttendanceKind" AS ENUM ('UPDATE_SINGLE', 'UPDATE_FAMILY', 'INCLUDE_FAMILY', 'INCLUDE_SINGLE_BF', 'INCLUDE_SINGLE_BPC', 'VERIFICATION', 'GUIDANCE');
CREATE TYPE "OpinionStatus" AS ENUM ('PENDING', 'WITH', 'WITHOUT');
CREATE TYPE "ResponsibleRole" AS ENUM ('RF', 'RL');
CREATE TABLE "Attendance" (
  "id" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "unitId" TEXT NOT NULL,
  "serviceDate" DATE NOT NULL,
  "name" TEXT NOT NULL,
  "cpf" TEXT NOT NULL,
  "responsibleRole" "ResponsibleRole" NOT NULL DEFAULT 'RF',
  "familyCode" TEXT,
  "phone" TEXT,
  "kind" "AttendanceKind" NOT NULL,
  "opinion" "OpinionStatus" NOT NULL,
  "crowded" BOOLEAN NOT NULL DEFAULT false,
  "version" INTEGER NOT NULL DEFAULT 1,
  "operatorName" TEXT NOT NULL,
  "operatorRegistration" TEXT NOT NULL,
  "operatorCategory" TEXT NOT NULL,
  "unitName" TEXT NOT NULL,
  "unitCode" TEXT NOT NULL,
  "timezone" TEXT NOT NULL,
  "cancelledAt" TIMESTAMP(3),
  "cancellationReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Attendance_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Attendance_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Attendance_code_check" CHECK (("kind" = 'GUIDANCE' AND "familyCode" IS NULL) OR ("kind" <> 'GUIDANCE' AND "familyCode" IS NOT NULL AND "familyCode" ~ '^[0-9]{1,20}$')),
  CONSTRAINT "Attendance_opinion_check" CHECK ("kind" IN ('UPDATE_SINGLE', 'UPDATE_FAMILY', 'VERIFICATION') OR "opinion" = 'WITHOUT'),
  CONSTRAINT "Attendance_cancellation_check" CHECK (("cancelledAt" IS NULL AND "cancellationReason" IS NULL) OR ("cancelledAt" IS NOT NULL AND "cancellationReason" IS NOT NULL AND length(btrim("cancellationReason")) BETWEEN 5 AND 500)),
  CONSTRAINT "Attendance_version_check" CHECK ("version" > 0)
);
CREATE INDEX "Attendance_ownerUserId_serviceDate_id_idx" ON "Attendance"("ownerUserId", "serviceDate", "id");
CREATE INDEX "Attendance_unitId_serviceDate_idx" ON "Attendance"("unitId", "serviceDate");
CREATE INDEX "Attendance_cpf_serviceDate_idx" ON "Attendance"("cpf", "serviceDate");
CREATE TRIGGER attendance_no_delete BEFORE DELETE ON "Attendance"
FOR EACH ROW EXECUTE FUNCTION cadflux_reject_identity_delete();
CREATE TRIGGER attendance_no_truncate BEFORE TRUNCATE ON "Attendance"
FOR EACH STATEMENT EXECUTE FUNCTION cadflux_reject_identity_delete();
CREATE FUNCTION cadflux_protect_attendance() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."cancelledAt" IS NOT NULL THEN
    RAISE EXCEPTION 'Cancelled attendance is immutable' USING ERRCODE = '23514';
  END IF;
  IF ROW(NEW."id", NEW."ownerUserId", NEW."unitId", NEW."cpf", NEW."responsibleRole", NEW."operatorName", NEW."operatorRegistration", NEW."operatorCategory", NEW."unitName", NEW."unitCode", NEW."timezone", NEW."createdAt") IS DISTINCT FROM
     ROW(OLD."id", OLD."ownerUserId", OLD."unitId", OLD."cpf", OLD."responsibleRole", OLD."operatorName", OLD."operatorRegistration", OLD."operatorCategory", OLD."unitName", OLD."unitCode", OLD."timezone", OLD."createdAt") THEN
    RAISE EXCEPTION 'Attendance identity and institutional snapshot are immutable' USING ERRCODE = '23514';
  END IF;
  IF OLD."opinion" <> 'PENDING' AND NEW."opinion" <> OLD."opinion" THEN
    RAISE EXCEPTION 'Opinion decision is immutable' USING ERRCODE = '23514';
  END IF;
  IF NEW."version" <> OLD."version" + 1 THEN
    RAISE EXCEPTION 'Attendance version must advance once' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER attendance_protect_update BEFORE UPDATE ON "Attendance"
FOR EACH ROW EXECUTE FUNCTION cadflux_protect_attendance();
