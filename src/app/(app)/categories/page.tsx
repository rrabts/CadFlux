import { requirePageUser } from "@/modules/auth/service";
import { ReferencePage } from "@/components/reference-pages";
export default async function CategoriesPage() {
  await requirePageUser("reference:read");
  return <ReferencePage kind="categories" />;
}
