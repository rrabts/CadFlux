import { requirePageUser } from "@/modules/auth/service";
import { UserEditor } from "@/components/user-management";
export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser("users:manage");
  const { id } = await params;
  return <UserEditor userId={id} viewerId={user.id} />;
}
