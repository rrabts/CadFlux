import { json, readJson } from "@/lib/responses";
import { apiError, assertSameOrigin } from "@/lib/errors";
import { requireApiUser } from "@/modules/auth/service";
import { createAttendance, listAttendances } from "@/modules/attendances/service";
export async function GET(request: Request) {
  try {
    return json(
      await listAttendances(
        await requireApiUser(request, "attendances:read"),
        Object.fromEntries(new URL(request.url).searchParams),
      ),
    );
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    return json(
      await createAttendance(
        await requireApiUser(request, "attendances:create"),
        await readJson(request),
      ),
      201,
    );
  } catch (error) {
    return apiError(error);
  }
}
