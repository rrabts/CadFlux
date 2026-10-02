import { NextResponse } from "next/server";
import { requireApiUser } from "@/modules/auth/service";
import { AppError, apiError, assertSameOrigin } from "@/lib/errors";
import { createImportPreview } from "@/modules/imports/service";
import { readBoundedBody } from "@/modules/imports/request";
import { MAX_IMPORT_BYTES } from "@/modules/imports/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const actor = await requireApiUser(request, "users:manage");
    if (!request.headers.get("content-type")?.startsWith("multipart/form-data;"))
      throw new AppError(400, "Envie um arquivo CSV ou XLSX.");
    const body = await readBoundedBody(request, MAX_IMPORT_BYTES + 64 * 1024);
    let data: FormData;
    try {
      data = await new Request(request.url, {
        method: "POST",
        headers: request.headers,
        body: body as BodyInit,
      }).formData();
    } catch {
      throw new AppError(400, "Upload inválido.");
    }
    const file = data.get("file");
    if (!(file instanceof File) || [...data.entries()].length !== 1)
      throw new AppError(400, "Envie exatamente um arquivo no campo file.");
    const extension = file.name.split(".").at(-1)?.toLowerCase();
    const acceptedTypes =
      extension === "csv"
        ? [
            "text/csv",
            "text/plain",
            "application/csv",
            "application/vnd.ms-excel",
            "application/octet-stream",
            "",
          ]
        : [
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/octet-stream",
            "",
          ];
    if (!acceptedTypes.includes(file.type))
      throw new AppError(400, "O tipo de conteúdo não corresponde a CSV ou XLSX.");
    const preview = await createImportPreview(
      actor,
      new Uint8Array(await file.arrayBuffer()),
      file.name,
    );
    return NextResponse.json(preview, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
