import { json, readJson } from "@/lib/responses";
import { apiError, assertSameOrigin } from "@/lib/errors";
import { requireApiUser } from "@/modules/auth/service";
import { referenceKindSchema } from "@/modules/references/schema";
import { listReferencePage, saveReference } from "@/modules/references/service";
type Context = { params: Promise<{ kind: string }> };
export async function GET(request: Request, context: Context) {
  try {
    const actor = await requireApiUser(request, "reference:read");
    const kind = referenceKindSchema.parse((await context.params).kind);
    return json(
      await listReferencePage(actor, kind, Object.fromEntries(new URL(request.url).searchParams)),
    );
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    const actor = await requireApiUser(request, "reference:manage");
    const kind = referenceKindSchema.parse((await context.params).kind);
    return json({ item: await saveReference(actor, kind, await readJson(request)) }, 201);
  } catch (error) {
    return apiError(error);
  }
}
