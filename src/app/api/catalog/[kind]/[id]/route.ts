import { json, readJson } from "@/lib/responses";
import { apiError, assertSameOrigin } from "@/lib/errors";
import { requireApiUser } from "@/modules/auth/service";
import { catalogKind, catalogHistory, saveCatalog } from "@/modules/catalog/service";
type Context = { params: Promise<{ kind: string; id: string }> };
export async function GET(request: Request, context: Context) {
  try {
    const actor = await requireApiUser(request, "reference:read");
    const p = await context.params;
    return json(await catalogHistory(actor, catalogKind.parse(p.kind), p.id));
  } catch (e) {
    return apiError(e);
  }
}
export async function PATCH(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    const actor = await requireApiUser(request, "reference:manage");
    const p = await context.params;
    return json(await saveCatalog(actor, catalogKind.parse(p.kind), await readJson(request), p.id));
  } catch (e) {
    return apiError(e);
  }
}
