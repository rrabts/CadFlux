import { requirePage } from "@/server/auth";
import { ImportWizard } from "@/modules/imports/import-wizard";
export default async function Import() {
  await requirePage("users:manage");
  return <ImportWizard />;
}
