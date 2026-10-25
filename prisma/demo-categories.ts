import type { Prisma } from "@prisma/client";

/** Reuse renamed demo categories without rewriting their names, status or IDs. */
export async function ensureDemoCategories(
  tx: Pick<Prisma.TransactionClient, "professionalCategory">,
) {
  return Promise.all(
    ["Entrevistador", "Assistente Social", "Coordenação", "Visitador"].map(async (name) => {
      const existing = await tx.professionalCategory.findFirst({
        where: { name: { equals: name, mode: "insensitive" } },
      });
      return (
        existing ??
        tx.professionalCategory.upsert({ where: { name }, create: { name }, update: {} })
      );
    }),
  );
}
