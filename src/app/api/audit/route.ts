import { prisma } from "@/lib/db";
import { json } from "@/lib/responses";
import { apiError } from "@/lib/errors";
import { requireApiUser } from "@/modules/auth/service";
import { auditPage } from "@/modules/audit/pagination";
export async function GET(request: Request) {
  try {
    await requireApiUser(request, "audit:read");
    return json(
      await auditPage(
        prisma,
        {},
        new URL(request.url).searchParams.get("cursor") ?? undefined,
        200,
      ),
    );
  } catch (error) {
    return apiError(error);
  }
}
