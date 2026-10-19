import { json, readJson } from "@/lib/responses";
import { apiError, assertSameOrigin } from "@/lib/errors";
import { requireApiUser } from "@/modules/auth/service";
import { referenceKindSchema } from "@/modules/references/schema";
import { getReference, saveReference } from "@/modules/references/service";
type Context = { params: Promise<{ kind: string; id: string }> };
export async function GET(request: Request, context: Context) {
  try {
    const actor = await requireApiUser(request, "reference:read");
    const { kind, id } = await context.params;
    return json(await getReference(actor, referenceKindSchema.parse(kind), id));
  } catch (error) {
    return apiError(error);
  }
}
export async function PATCH(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    const actor = await requireApiUser(request, "reference:manage");
    const { kind, id } = await context.params;
    return json({
      item: await saveReference(
        actor,
        referenceKindSchema.parse(kind),
        await readJson(request),
        id,
      ),
    });
  } catch (error) {
    return apiError(error);
  }
}
