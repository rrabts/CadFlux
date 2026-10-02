import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { apiError, AppError, assertSameOrigin } from "@/lib/errors";
import {
  login,
  logout,
  changePassword,
  SESSION_COOKIE,
  SESSION_SECONDS,
} from "@/modules/auth/service";
import { currentUser } from "@/server/auth";
import { assertPermission } from "@/modules/permissions/service";
import { createUser, updateUser, listUsers, freshActor } from "@/modules/users/service";
import { safeUserSelect } from "@/modules/users/types";
import { previewImport, confirmImport, MAX_BYTES, columns } from "@/modules/imports/service";
import { unitSchema } from "@/modules/units/schema";
import { categorySchema } from "@/modules/professional-categories/schema";
import { audit } from "@/modules/audit/service";
export const runtime = "nodejs";
async function json(request: Request) {
  const raw = await boundedBody(request, 16384);
  try {
    return JSON.parse(raw.toString("utf8")) as unknown;
  } catch {
    throw new AppError(400, "JSON inválido.");
  }
}
async function boundedBody(request: Request, max: number) {
  if (Number(request.headers.get("content-length")) > max)
    throw new AppError(413, "Solicitação muito grande.");
  const reader = request.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const parts: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      throw new AppError(413, "Solicitação muito grande.");
    }
    parts.push(value);
  }
  return Buffer.concat(parts);
}
async function handler(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  try {
    const path = (await params).path,
      route = path.join("/"),
      method = request.method;
    if (method !== "GET") assertSameOrigin(request);
    const jar = await cookies();
    if (route === "auth/login" && method === "POST") {
      const result = await login(await json(request));
      jar.set(SESSION_COOKIE, result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: SESSION_SECONDS,
      });
      return NextResponse.json({ user: result.user });
    }
    if (route === "auth/logout" && method === "POST") {
      await logout(jar.get(SESSION_COOKIE)?.value);
      jar.delete(SESSION_COOKIE);
      return NextResponse.json({ ok: true });
    }
    const actor = await currentUser();
    if (route === "auth/me" && method === "GET") return NextResponse.json(actor);
    if (route === "auth/password" && method === "POST") {
      assertPermission(actor, "account:password");
      await changePassword(actor.id, await json(request));
      jar.delete(SESSION_COOKIE);
      return NextResponse.json({ ok: true });
    }
    assertPermission(actor, "users:manage");
    if (route === "references" && method === "GET") {
      const [units, categories] = await Promise.all([
        prisma.unit.findMany({ orderBy: { name: "asc" } }),
        prisma.professionalCategory.findMany({ orderBy: { name: "asc" } }),
      ]);
      return NextResponse.json({ units, categories });
    }
    if (route === "users" && method === "GET")
      return NextResponse.json(
        await listUsers(actor, Object.fromEntries(request.nextUrl.searchParams)),
      );
    if (route === "users" && method === "POST")
      return NextResponse.json(await createUser(actor, await json(request)), { status: 201 });
    if (path[0] === "users" && path.length === 2) {
      if (method === "PATCH")
        return NextResponse.json(await updateUser(actor, path[1], await json(request)));
      if (method === "GET") {
        const user = await prisma.user.findUnique({
          where: { id: path[1] },
          select: safeUserSelect,
        });
        if (!user) throw new AppError(404, "Usuário não encontrado.");
        return NextResponse.json(user);
      }
    }
    if (path[0] === "users" && path.length === 3 && path[2] === "history" && method === "GET")
      return NextResponse.json(
        await prisma.auditLog.findMany({
          where: { entityType: "User", entityId: path[1] },
          orderBy: { createdAt: "desc" },
          take: 100,
        }),
      );
    if (route === "audit" && method === "GET")
      return NextResponse.json(
        await prisma.auditLog.findMany({
          orderBy: { createdAt: "desc" },
          take: 200,
          include: { actor: { select: { name: true } } },
        }),
      );
    if (route === "imports/template" && method === "GET")
      return new NextResponse(columns.join(",") + "\n", {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": "attachment; filename=cadflux-usuarios.csv",
        },
      });
    if (route === "imports/preview" && method === "POST") {
      const raw = await boundedBody(request, MAX_BYTES + 16384);
      const form = await new Request(request.url, {
        method: "POST",
        headers: { "content-type": request.headers.get("content-type") ?? "" },
        body: raw,
      })
        .formData()
        .catch(() => {
          throw new AppError(400, "Upload malformado.");
        });
      const file = form.get("file");
      if (!(file instanceof File)) throw new AppError(400, "Selecione um arquivo.");
      return NextResponse.json(
        await previewImport(actor, file.name, Buffer.from(await file.arrayBuffer())),
      );
    }
    if (path[0] === "imports" && path[2] === "confirm" && path.length === 3 && method === "POST")
      return NextResponse.json(await confirmImport(actor, path[1]));
    if (
      (path[0] === "units" || path[0] === "categories") &&
      ((method === "POST" && path.length === 1) || (method === "PATCH" && path.length === 2))
    ) {
      const input = await json(request),
        isUnit = path[0] === "units";
      const data = isUnit ? unitSchema.parse(input) : categorySchema.parse(input);
      const result = await prisma.$transaction(async (tx) => {
        await freshActor(tx, actor);
        const record = isUnit
          ? method === "POST"
            ? await tx.unit.create({ data: unitSchema.parse(data) })
            : await tx.unit.update({ where: { id: path[1] }, data: unitSchema.parse(data) })
          : method === "POST"
            ? await tx.professionalCategory.create({ data: categorySchema.parse(data) })
            : await tx.professionalCategory.update({
                where: { id: path[1] },
                data: categorySchema.parse(data),
              });
        await audit(
          tx,
          actor.id,
          method === "POST" ? "REFERENCE_CREATED" : "REFERENCE_UPDATED",
          isUnit ? "Unit" : "ProfessionalCategory",
          record.id,
          undefined,
          data,
        );
        return record;
      });
      return NextResponse.json(result);
    }
    throw new AppError(404, "Operação não encontrada.");
  } catch (error) {
    return apiError(error);
  }
}
export async function GET(request: NextRequest, context: Parameters<typeof handler>[1]) {
  const response = await handler(request, context);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
export const POST = GET;
export const PATCH = GET;
