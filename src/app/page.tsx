import { redirect } from "next/navigation";
import { getCurrentUser } from "@/modules/auth/service";
export default async function HomePage() {
  const user = await getCurrentUser();
  redirect(user ? (user.mustChangePassword ? "/change-password" : "/dashboard") : "/login");
}
