import { prisma } from "@/lib/db";
import { json, readJson } from "@/lib/responses";
import { apiError, assertSameOrigin, AppError } from "@/lib/errors";
import { requireApiUser } from "@/modules/auth/service";
import { updateUser, safeUserSelect } from "@/modules/users/service";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  try {
    await requireApiUser(request, "users:read");
    const { id } = await context.params;
    const user = await prisma.user.findUnique({ where: { id }, select: safeUserSelect });
    if (!user) throw new AppError(404, "Usuário não encontrado.");
    const history = await prisma.auditLog.findMany({
      where: { entityType: "User", entityId: id },
      include: { actor: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return json({
      user,
      history: history.map(({ actor, ...row }) => ({ ...row, actorUser: actor })),
    });
  } catch (error) {
    return apiError(error);
  }
}
export async function PATCH(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    const actor = await requireApiUser(request, "users:manage");
    const { id } = await context.params;
    return json({ user: await updateUser(actor, id, await readJson(request)) });
  } catch (error) {
    return apiError(error);
  }
}
