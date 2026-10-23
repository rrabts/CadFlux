import { json, readJson } from "@/lib/responses";
import { apiError, assertSameOrigin } from "@/lib/errors";
import { requireApiUser } from "@/modules/auth/service";
import { attendanceConfiguration, setOperationalUnit } from "@/modules/operations/service";
export async function GET(request: Request) {
  try {
    return json(await attendanceConfiguration(await requireApiUser(request, "attendances:read")));
  } catch (e) {
    return apiError(e);
  }
}
export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const actor = await requireApiUser(request, "attendances:create");
    return json(await setOperationalUnit(actor, await readJson(request)));
  } catch (e) {
    return apiError(e);
  }
}
