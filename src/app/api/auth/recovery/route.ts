import { z } from "zod";
import { json, readJson } from "@/lib/responses";
import { apiError, assertSameOrigin } from "@/lib/errors";
import { requestPasswordRecovery } from "@/modules/auth/service";
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { email } = z
      .object({ email: z.email().max(254) })
      .strict()
      .parse(await readJson(request));
    await requestPasswordRecovery(email);
    return json({
      message: "Recuperação preparada para integração futura. Solicite orientação à Direção.",
    });
  } catch (error) {
    return apiError(error);
  }
}
