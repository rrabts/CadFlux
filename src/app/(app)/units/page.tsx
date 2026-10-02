import { requirePageUser } from "@/modules/auth/service";
import { ReferencePage } from "@/components/reference-pages";
export default async function UnitsPage() {
  await requirePageUser("reference:read");
  return <ReferencePage kind="units" />;
}
