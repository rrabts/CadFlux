import { requirePageUser } from "@/modules/auth/service";
import { AttendanceList } from "@/components/attendance-management";
export default async function AttendancesPage() {
  const actor = await requirePageUser("attendances:read");
  return <AttendanceList direction={actor.accessProfile === "DIRECTION"} />;
}
