import { json, readJson } from "@/lib/responses";
import { apiError, assertSameOrigin } from "@/lib/errors";
import { requireApiUser } from "@/modules/auth/service";
import { catalogKind, listCatalog, saveCatalog } from "@/modules/catalog/service";
type Context = { params: Promise<{ kind: string }> };
export async function GET(request: Request, context: Context) {
  try {
    const actor = await requireApiUser(request, "reference:read");
    return json(
      await listCatalog(
        actor,
        catalogKind.parse((await context.params).kind),
        Object.fromEntries(new URL(request.url).searchParams),
      ),
    );
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    const actor = await requireApiUser(request, "reference:manage");
    return json(
      await saveCatalog(
        actor,
        catalogKind.parse((await context.params).kind),
        await readJson(request),
      ),
      201,
    );
  } catch (e) {
    return apiError(e);
  }
}
