import { json, readJson } from "@/lib/responses";
import { apiError, assertSameOrigin } from "@/lib/errors";
import { requireApiUser } from "@/modules/auth/service";
import { cancelAttendance } from "@/modules/attendances/service";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    return json(
      await cancelAttendance(
        await requireApiUser(request, "attendances:update"),
        (await context.params).id,
        await readJson(request),
      ),
    );
  } catch (error) {
    return apiError(error);
  }
}
