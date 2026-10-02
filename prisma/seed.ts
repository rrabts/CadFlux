import { PrismaClient, AccessProfile } from "@prisma/client";
import { hashPassword } from "../src/modules/auth/password";
const db = new PrismaClient();
async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Seed fictício proibido em produção.");
  const categories = [];
  for (const name of ["Entrevistador", "Assistente Social", "Coordenação", "Visitador"])
    categories.push(
      await db.professionalCategory.upsert({ where: { name }, create: { name }, update: {} }),
    );
  const unit = await db.unit.upsert({
    where: { code: "DEMO-01" },
    create: { name: "Unidade Demonstração", code: "DEMO-01" },
    update: {},
  });
  const passwordHash = await hashPassword("CadFlux!Dev2026");
  for (const [i, profile] of [
    AccessProfile.DIRECTION,
    AccessProfile.INTERVIEWER,
    AccessProfile.REFERRAL_OPERATOR,
  ].entries()) {
    const login = ["direcao", "entrevistador", "encaminhador"][i];
    await db.user.upsert({
      where: { email: `${login}@cadflux.local` },
      update: {},
      create: {
        name: `Usuário Fictício ${i + 1}`,
        email: `${login}@cadflux.local`,
        registrationNumber: `DEMO-00${i + 1}`,
        accessProfile: profile,
        professionalCategoryId: categories[i === 0 ? 2 : i === 1 ? 0 : 1].id,
        primaryUnitId: unit.id,
        passwordHash,
        mustChangePassword: true,
      },
    });
  }
}
main().finally(() => db.$disconnect());
