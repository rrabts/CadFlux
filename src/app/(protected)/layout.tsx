import { requirePage } from "@/server/auth";
import { Shell } from "@/components/layout/shell";
export default async function Layout({ children }: { children: React.ReactNode }) {
  const user = await requirePage("account:read");
  return <Shell user={user}>{children}</Shell>;
}
