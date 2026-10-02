import { requirePageUser } from "@/modules/auth/service";
import { UserList } from "@/components/user-management";
export default async function UsersPage() {
  await requirePageUser("users:read");
  return <UserList />;
}
