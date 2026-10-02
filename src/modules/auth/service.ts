import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { safeUserSelect } from "@/modules/users/types";
import { audit } from "@/modules/audit/service";
import { hashPassword, verifyPassword, randomToken, tokenHash } from "./password";
import { z } from "zod";
export const SESSION_SECONDS = 8 * 60 * 60;
export const SESSION_COOKIE =
  process.env.NODE_ENV === "production" ? "__Host-cadflux-session" : "cadflux-session";
export const loginSchema = z
  .object({ login: z.string().trim().min(1).max(254), password: z.string().min(1).max(256) })
  .strict();
export async function login(input: unknown) {
  const { login: identifier, password } = loginSchema.parse(input);
  const key = tokenHash(identifier.toLowerCase());
  const now = new Date();
  const limit = await prisma.loginRateLimit.upsert({
    where: { key },
    create: { key, attempts: 1 },
    update: { attempts: { increment: 1 } },
  });
  if (now.getTime() - limit.windowStartedAt.getTime() > 15 * 60 * 1000)
    await prisma.loginRateLimit.update({
      where: { key },
      data: { attempts: 1, windowStartedAt: now },
    });
  else if (limit.attempts > 10) throw new AppError(429, "Muitas tentativas. Aguarde 15 minutos.");
  const user = await prisma.user.findFirst({
    where: { OR: [{ email: identifier.toLowerCase() }, { registrationNumber: identifier }] },
  });
  // Perform the same expensive operation for unknown accounts.
  const fallback = "scrypt:00000000000000000000000000000000:" + "00".repeat(64);
  const valid = await verifyPassword(password, user?.passwordHash ?? fallback);
  if (!user || !valid || user.status !== "ACTIVE")
    throw new AppError(401, "Usuário ou senha inválidos.");
  const token = randomToken();
  await prisma.$transaction(async (tx) => {
    const current = await tx.user.findUniqueOrThrow({ where: { id: user.id } });
    if (current.status !== "ACTIVE" || current.passwordHash !== user.passwordHash)
      throw new AppError(401, "Usuário ou senha inválidos.");
    await tx.session.create({
      data: {
        tokenHash: tokenHash(token),
        userId: user.id,
        expiresAt: new Date(now.getTime() + SESSION_SECONDS * 1000),
      },
    });
    await tx.user.update({ where: { id: user.id }, data: { lastLoginAt: now } });
    await audit(tx, user.id, "LOGIN", "User", user.id);
    await tx.loginRateLimit.deleteMany({ where: { key } });
  });
  return {
    token,
    user: await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: safeUserSelect }),
  };
}
export async function authenticate(token?: string) {
  if (!token) throw new AppError(401, "Entre para continuar.");
  const session = await prisma.session.findUnique({
    where: { tokenHash: tokenHash(token) },
    include: { user: { select: safeUserSelect } },
  });
  if (!session || session.expiresAt <= new Date() || session.user.status !== "ACTIVE")
    throw new AppError(401, "Sua sessão expirou. Entre novamente.");
  return session.user;
}
export async function logout(token?: string) {
  if (token) await prisma.session.deleteMany({ where: { tokenHash: tokenHash(token) } });
}
export async function changePassword(userId: string, input: unknown) {
  const data = z
    .object({
      currentPassword: z.string().min(1).max(256),
      newPassword: z.string().min(12, "Use pelo menos 12 caracteres.").max(128),
    })
    .strict()
    .parse(input);
  if (data.currentPassword === data.newPassword)
    throw new AppError(400, "A nova senha deve ser diferente.");
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!(await verifyPassword(data.currentPassword, user.passwordHash)))
    throw new AppError(400, "Senha atual incorreta.");
  const passwordHash = await hashPassword(data.newPassword);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: false, passwordChangedAt: new Date() },
    });
    await tx.session.deleteMany({ where: { userId } });
    await audit(tx, userId, "PASSWORD_CHANGED", "User", userId);
  });
}
// Future adapters: recovery tokens are stored hashed; MFA secrets must be encrypted by a key service.
export interface InvitationDelivery {
  sendInvitation(email: string, oneTimeToken: string): Promise<void>;
}
export interface MfaVerifier {
  verify(userId: string, challenge: string): Promise<boolean>;
}
export const mfaPolicy = { requiredInFuture: ["DIRECTION"] as const, enforced: false };
