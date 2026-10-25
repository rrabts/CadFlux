import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { AppError } from "@/lib/errors";

const cursorSchema = z.object({ at: z.iso.datetime(), id: z.string().min(1).max(100) }).strict();

function decodeCursor(value: string | undefined) {
  if (value === undefined) return undefined;
  try {
    if (value.length > 500 || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error();
    const parsed = cursorSchema.parse(JSON.parse(Buffer.from(value, "base64url").toString("utf8")));
    return { createdAt: new Date(parsed.at), id: parsed.id };
  } catch {
    throw new AppError(400, "Cursor de histórico inválido. Recarregue a consulta.");
  }
}

/** The caller must authorize the resource before reading any page. The cursor only narrows that scope. */
export async function auditPage(
  db: Pick<Prisma.TransactionClient, "auditLog">,
  where: Prisma.AuditLogWhereInput,
  cursor?: string,
  pageSize = 100,
  includeActorEmail = true,
) {
  const after = decodeCursor(cursor);
  const rows = await db.auditLog.findMany({
    where: {
      AND: [
        where,
        ...(after
          ? [
              {
                OR: [
                  { createdAt: { lt: after.createdAt } },
                  { createdAt: after.createdAt, id: { lt: after.id } },
                ],
              },
            ]
          : []),
      ],
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: pageSize + 1,
    include: { actor: { select: { name: true, email: true } } },
  });
  const entries = rows.slice(0, pageSize);
  const last = entries.at(-1);
  return {
    entries: entries.map(({ actor, ...entry }) => ({
      ...entry,
      actorUser: actor && (includeActorEmail ? actor : { name: actor.name }),
    })),
    nextHistoryCursor:
      rows.length > pageSize && last
        ? Buffer.from(JSON.stringify({ at: last.createdAt.toISOString(), id: last.id })).toString(
            "base64url",
          )
        : null,
  };
}
