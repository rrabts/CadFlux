import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { authenticate, SESSION_COOKIE } from "@/modules/auth/service";
import { assertPermission, type Action } from "@/modules/permissions/service";
import { AppError } from "@/lib/errors";
export async function currentUser() {
  return authenticate((await cookies()).get(SESSION_COOKIE)?.value);
}
export async function requirePage(action: Action) {
  let user;
  try {
    user = await currentUser();
  } catch (error) {
    if (error instanceof AppError && error.status === 401) redirect("/login");
    throw error;
  }
  if (user.mustChangePassword && action !== "account:password" && action !== "account:read")
    redirect("/profile");
  try {
    assertPermission(user, action);
  } catch (error) {
    if (error instanceof AppError) redirect("/forbidden");
    throw error;
  }
  return user;
}
