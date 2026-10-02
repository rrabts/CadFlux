import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class AppError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function apiError(error: unknown): NextResponse {
  if (error instanceof AppError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: "Verifique os campos informados.",
        issues: error.issues.map(({ path, message }) => ({ path, message })),
      },
      { status: 400 },
    );
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002")
      return NextResponse.json(
        { error: "E-mail, matrícula ou identificador já cadastrado." },
        { status: 409 },
      );
    if (error.code === "P2025")
      return NextResponse.json({ error: "Registro não encontrado." }, { status: 404 });
    if (error.code === "P2034")
      return NextResponse.json(
        { error: "Uma alteração simultânea ocorreu. Tente novamente." },
        { status: 409 },
      );
  }
  console.error("CadFlux API error", error instanceof Error ? error.name : "UnknownError");
  return NextResponse.json({ error: "Não foi possível concluir a operação." }, { status: 500 });
}

export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  const expected = process.env.APP_URL
    ? new URL(process.env.APP_URL).origin
    : new URL(request.url).origin;
  if (!origin || origin !== expected)
    throw new AppError(403, "Origem da solicitação não permitida.");
  if (request.headers.get("sec-fetch-site") === "cross-site")
    throw new AppError(403, "Solicitação entre sites não permitida.");
}
