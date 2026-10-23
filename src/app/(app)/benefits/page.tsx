import { requirePageUser } from "@/modules/auth/service";
import { CatalogPage } from "@/components/catalog-management";
export default async function Page() {
  await requirePageUser("reference:manage");
  return <CatalogPage kind="benefits" />;
}
