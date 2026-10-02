import { prisma } from "@/lib/db";
import { json } from "@/lib/responses";
import { apiError } from "@/lib/errors";
import { requireApiUser } from "@/modules/auth/service";
export async function GET(request: Request) {
  try {
    await requireApiUser(request, "reference:read");
    const [units, categories] = await Promise.all([
      prisma.unit.findMany({ orderBy: { name: "asc" } }),
      prisma.professionalCategory.findMany({ orderBy: { name: "asc" } }),
    ]);
    return json({ units, categories });
  } catch (error) {
    return apiError(error);
  }
}
