import { requirePageUser } from "@/modules/auth/service";
import { AuditPage } from "@/components/reference-pages";
export default async function AuditPageRoute() {
  await requirePageUser("audit:read");
  return <AuditPage />;
}
