import { json, readJson } from "@/lib/responses";
import { apiError, assertSameOrigin } from "@/lib/errors";
import { changePassword, requireApiUser, SESSION_COOKIE } from "@/modules/auth/service";
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const actor = await requireApiUser(request, "account:password");
    await changePassword(actor, await readJson(request));
    const response = json({ ok: true });
    response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
    return response;
  } catch (error) {
    return apiError(error);
  }
}
