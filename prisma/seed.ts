import { PrismaClient, AccessProfile } from "@prisma/client";
import { hashPassword } from "../src/modules/auth/password";
const prisma = new PrismaClient();
async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Seed fictício proibido em produção.");
  if (!process.env.DATABASE_URL) throw new Error("Configure DATABASE_URL.");
  const url = new URL(process.env.DATABASE_URL);
  if (
    !["localhost", "127.0.0.1", "::1"].includes(url.hostname) &&
    process.env.CADFLUX_ALLOW_DEMO_SEED !== "1"
  )
    throw new Error("Seed externo exige CADFLUX_ALLOW_DEMO_SEED=1 para banco fictício.");
  const categories = await Promise.all(
    ["Entrevistador", "Assistente Social", "Coordenação", "Visitador"].map((name) =>
      prisma.professionalCategory.upsert({ where: { name }, create: { name }, update: {} }),
    ),
  );
  const units = await Promise.all(
    [
      { name: "Unidade Central — Demonstração", code: "DEMO-CENTRAL" },
      { name: "Unidade Norte — Demonstração", code: "DEMO-NORTE" },
    ].map((data) => prisma.unit.upsert({ where: { code: data.code }, create: data, update: {} })),
  );
  const passwordHash = await hashPassword("CadFlux!Demo2026");
  for (const [index, profile] of [
    AccessProfile.DIRECTION,
    AccessProfile.INTERVIEWER,
    AccessProfile.REFERRAL_OPERATOR,
  ].entries()) {
    const login = ["direcao", "entrevistador", "encaminhador"][index];
    await prisma.user.upsert({
      where: { email: login + "@cadflux.local" },
      update: {},
      create: {
        name: ["Direção Fictícia", "Entrevistador Fictício", "Encaminhador Fictício"][index],
        email: login + "@cadflux.local",
        registrationNumber: "DEMO-00" + (index + 1),
        functionalIdentifier: "FUNC-DEMO-" + (index + 1),
        passwordHash,
        accessProfile: profile,
        primaryUnitId: units[0].id,
        professionalCategoryId: categories[index === 0 ? 2 : index === 1 ? 0 : 1].id,
        mustChangePassword: false,
        passwordChangedAt: new Date(),
      },
    });
  }
  console.log(
    "Seed fictício concluído: 3 contas de demonstração, 2 unidades e 4 categorias. Contas existentes preservadas.",
  );
}
main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Falha no seed.");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
