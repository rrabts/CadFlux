import { json, readJson } from "@/lib/responses";
import { apiError, assertSameOrigin } from "@/lib/errors";
import { requireApiUser } from "@/modules/auth/service";
import { getAttendance, updateAttendance } from "@/modules/attendances/service";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  try {
    return json(
      await getAttendance(
        await requireApiUser(request, "attendances:read"),
        (await context.params).id,
      ),
    );
  } catch (error) {
    return apiError(error);
  }
}
export async function PATCH(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    return json(
      await updateAttendance(
        await requireApiUser(request, "attendances:update"),
        (await context.params).id,
        await readJson(request),
      ),
    );
  } catch (error) {
    return apiError(error);
  }
}
