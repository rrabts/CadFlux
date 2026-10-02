import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/modules/auth/service";
import { AppError, apiError, assertSameOrigin } from "@/lib/errors";
import { confirmImport } from "@/modules/imports/service";
import { readBoundedBody } from "@/modules/imports/request";

export const runtime = "nodejs";
const confirmSchema = z.object({ batchId: z.string().min(1).max(100) }).strict();

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const actor = await requireApiUser(request, "users:manage");
    const bytes = await readBoundedBody(request, 1024);
    let input: unknown;
    try {
      input = JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      throw new AppError(400, "Confirmação inválida.");
    }
    const { batchId } = confirmSchema.parse(input);
    const result = await confirmImport(actor, batchId);
    return NextResponse.json(result, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
