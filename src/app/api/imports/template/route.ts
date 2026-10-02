import { requireApiUser } from "@/modules/auth/service";
import { AppError, apiError } from "@/lib/errors";
import { createImportTemplate } from "@/modules/imports/parser";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireApiUser(request, "users:manage");
    const format = new URL(request.url).searchParams.get("format") || "csv";
    if (format !== "csv" && format !== "xlsx")
      throw new AppError(400, "Formato de modelo inválido.");
    const bytes = await createImportTemplate(format);
    return new Response(bytes as unknown as BodyInit, {
      headers: {
        "Content-Type":
          format === "csv"
            ? "text/csv; charset=utf-8"
            : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="cadflux-modelo-usuarios.${format}"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
