import { AppShell } from "@/components/app-shell";
import { requirePageUser } from "@/modules/auth/service";
export const dynamic = "force-dynamic";
export default async function ApplicationLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser("account:read");
  return <AppShell user={user}>{children}</AppShell>;
}
