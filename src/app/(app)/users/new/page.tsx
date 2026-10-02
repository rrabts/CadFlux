import { requirePageUser } from "@/modules/auth/service";
import { UserEditor } from "@/components/user-management";
export default async function NewUserPage() {
  const user = await requirePageUser("users:manage");
  return <UserEditor viewerId={user.id} />;
}
