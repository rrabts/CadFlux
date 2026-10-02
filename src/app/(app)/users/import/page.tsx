import { requirePageUser } from "@/modules/auth/service";
import { UserImport } from "@/components/user-import";
export default async function UserImportPage() {
  await requirePageUser("users:manage");
  return <UserImport />;
}
