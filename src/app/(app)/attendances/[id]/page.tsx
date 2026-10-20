import { requirePageUser } from "@/modules/auth/service";
import { AttendanceEditor } from "@/components/attendance-management";
export default async function AttendancePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePageUser("attendances:read");
  return <AttendanceEditor id={(await params).id} />;
}
