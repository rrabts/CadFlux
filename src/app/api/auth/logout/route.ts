import { json } from "@/lib/responses";
import { apiError, assertSameOrigin } from "@/lib/errors";
import { logout, SESSION_COOKIE, tokenFromRequest } from "@/modules/auth/service";
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await logout(tokenFromRequest(request));
    const response = json({ ok: true });
    response.cookies.set(SESSION_COOKIE, "", {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 0,
    });
    return response;
  } catch (error) {
    return apiError(error);
  }
}
