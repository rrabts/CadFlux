import { json, readJson } from "@/lib/responses";
import { apiError, assertSameOrigin } from "@/lib/errors";
import { authenticate, SESSION_COOKIE } from "@/modules/auth/service";
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const result = await authenticate(await readJson(request));
    const response = json({ user: result.user });
    response.cookies.set(SESSION_COOKIE, result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: result.expiresAt,
    });
    return response;
  } catch (error) {
    return apiError(error);
  }
}
