import { prisma } from "@/lib/db";
import { requirePageUser } from "@/modules/auth/service";
import { AttendanceEditor } from "@/components/attendance-management";
import { dateInTimezone } from "@/modules/attendances/contracts";
export default async function NewAttendancePage() {
  const actor = await requirePageUser("attendances:create");
  const unit = await prisma.unit.findUniqueOrThrow({ where: { id: actor.primaryUnitId } });
  return (
    <AttendanceEditor
      today={dateInTimezone(new Date(), unit.timezone)}
      contextLabel={`${actor.name} · ${unit.name}`}
    />
  );
}
