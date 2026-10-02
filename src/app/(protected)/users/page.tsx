import { requirePage } from "@/server/auth";
import { UserManager } from "@/modules/users/user-manager";
export default async function Users() {
  const actor = await requirePage("users:read");
  return <UserManager actorId={actor.id} />;
}
