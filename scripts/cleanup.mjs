import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
try {
  const now = new Date();
  await db.session.deleteMany({ where: { expiresAt: { lt: now } } });
  await db.passwordResetToken.deleteMany({ where: { expiresAt: { lt: now } } });
  await db.userImportBatch.updateMany({
    where: { status: "PREVIEW", expiresAt: { lt: now } },
    data: { status: "EXPIRED", rows: [] },
  });
  await db.loginRateLimit.deleteMany({
    where: { windowStartedAt: { lt: new Date(Date.now() - 3600000) } },
  });
  console.log("Dados temporários expirados removidos. Auditoria preservada.");
} finally {
  await db.$disconnect();
}
