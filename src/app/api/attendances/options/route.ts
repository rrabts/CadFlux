import { json } from "@/lib/responses";
import { apiError } from "@/lib/errors";
import { requireApiUser } from "@/modules/auth/service";
import { attendanceFilterOptions } from "@/modules/attendances/service";
export async function GET(request: Request) {
  try {
    return json(await attendanceFilterOptions(await requireApiUser(request, "attendances:read")));
  } catch (error) {
    return apiError(error);
  }
}
