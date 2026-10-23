import { json } from "@/lib/responses";
import { apiError } from "@/lib/errors";
import { requireApiUser } from "@/modules/auth/service";
import { indicators } from "@/modules/indicators/service";
export async function GET(request: Request) {
  try {
    const actor = await requireApiUser(request, "attendances:read");
    return json(await indicators(actor, Object.fromEntries(new URL(request.url).searchParams)));
  } catch (e) {
    return apiError(e);
  }
}
