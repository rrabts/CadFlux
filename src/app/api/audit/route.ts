import { prisma } from "@/lib/db";
import { json } from "@/lib/responses";
import { apiError } from "@/lib/errors";
import { requireApiUser } from "@/modules/auth/service";
export async function GET(request: Request) {
  try {
    await requireApiUser(request, "audit:read");
    const entries = await prisma.auditLog.findMany({
      include: { actor: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return json({
      entries: entries.map(({ actor, ...entry }) => ({ ...entry, actorUser: actor })),
    });
  } catch (error) {
    return apiError(error);
  }
}
