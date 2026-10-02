import { json, readJson } from "@/lib/responses";
import { apiError, assertSameOrigin } from "@/lib/errors";
import { requireApiUser } from "@/modules/auth/service";
import { listUsersPage, createUser } from "@/modules/users/service";
export async function GET(request: Request) {
  try {
    const actor = await requireApiUser(request, "users:read");
    return json(await listUsersPage(actor, Object.fromEntries(new URL(request.url).searchParams)));
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const actor = await requireApiUser(request, "users:manage");
    return json(await createUser(actor, await readJson(request)), 201);
  } catch (error) {
    return apiError(error);
  }
}
