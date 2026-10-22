import { z } from "zod";
import { json, readJson } from "@/lib/responses";
import { apiError, assertSameOrigin } from "@/lib/errors";
import { requireApiUser } from "@/modules/auth/service";
import { reuseAttendance } from "@/modules/attendances/service";
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const actor = await requireApiUser(request, "attendances:create");
    const { cpf } = z
      .object({ cpf: z.string() })
      .strict()
      .parse(await readJson(request));
    return json({ item: await reuseAttendance(actor, cpf) });
  } catch (error) {
    return apiError(error);
  }
}
