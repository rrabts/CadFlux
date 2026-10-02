import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AccessProfile, Prisma, UserStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { safeUserSelect, type SafeUser } from "@/modules/users/types";
import { assertPermission, type Action } from "@/modules/permissions/service";
import { writeAudit } from "@/modules/audit/service";
import { hashPassword, hashToken, verifyPassword } from "./password";

export const SESSION_COOKIE = "cadflux_session";
export const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
export const loginSchema = z
  .object({
    email: z
      .string()
      .trim()
      .min(1)
      .max(254)
      .transform((v) => v.toLowerCase()),
    password: z.string().min(1).max(256),
  })
  .strict();
export const passwordSchema = z
  .object({
    currentPassword: z.string().min(1).max(256),
    newPassword: z.string().min(12, "Use no mínimo 12 caracteres.").max(128),
  })
  .strict();

export async function authenticate(input: unknown) {
  const { email, password } = loginSchema.parse(input);
  const key = hashToken(email);
  const now = new Date();
  // The row lock also bounds concurrent failed attempts for the same account.
  const result = await prisma.$transaction(
    async (tx) => {
      await tx.loginRateLimit.upsert({ where: { key }, create: { key }, update: {} });
      await tx.$queryRaw`SELECT key FROM "LoginRateLimit" WHERE key = ${key} FOR UPDATE`;
      const limit = await tx.loginRateLimit.findUniqueOrThrow({ where: { key } });
      const expired = now.getTime() - limit.windowStartedAt.getTime() > 15 * 60 * 1000;
      if (!expired && limit.attempts >= 10) return { error: 429 } as const;
      const user = await tx.user.findUnique({ where: { email } });
      const valid = await verifyPassword(
        password,
        user?.passwordHash ?? "scrypt:00000000000000000000000000000000:" + "0".repeat(128),
      );
      if (!valid || !user || user.status !== UserStatus.ACTIVE) {
        await tx.loginRateLimit.update({
          where: { key },
          data: {
            attempts: expired ? 1 : limit.attempts + 1,
            ...(expired ? { windowStartedAt: now } : {}),
          },
        });
        await writeAudit(tx, {
          actorUserId: null,
          action: "LOGIN_FAILED",
          entityType: "Session",
          metadata: { accountKey: key },
        });
        return { error: 401 } as const;
      }
      const mfa = await tx.mfaCredential.findUnique({ where: { userId: user.id } });
      if (mfa?.status === "ENABLED") return { error: 403 } as const;
      await tx.loginRateLimit.update({
        where: { key },
        data: { attempts: 0, windowStartedAt: now },
      });
      const token = randomBytes(32).toString("base64url");
      const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
      await tx.session.create({
        data: { userId: user.id, tokenHash: hashToken(token), expiresAt },
      });
      const safeUser = await tx.user.update({
        where: { id: user.id },
        data: { lastLoginAt: now },
        select: safeUserSelect,
      });
      await writeAudit(tx, { actorUserId: user.id, action: "LOGIN", entityType: "Session" });
      return { token, expiresAt, user: safeUser } as const;
    },
    { maxWait: 10000, timeout: 20000 },
  );
  if (result.error !== undefined)
    throw new AppError(
      result.error,
      result.error === 429
        ? "Muitas tentativas. Aguarde 15 minutos."
        : result.error === 403
          ? "Verificação MFA necessária; integração preparada para fase futura."
          : "E-mail ou senha inválidos.",
    );
  return result;
}

export async function userFromToken(token: string | undefined): Promise<SafeUser | null> {
  if (!token || !/^[a-zA-Z0-9_-]{43}$/.test(token)) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: safeUserSelect } },
  });
  if (!session || session.expiresAt <= new Date() || session.user.status !== UserStatus.ACTIVE)
    return null;
  return session.user;
}
export async function getCurrentUser() {
  return userFromToken((await cookies()).get(SESSION_COOKIE)?.value);
}
export function tokenFromRequest(request: Request): string | undefined {
  return request.headers
    .get("cookie")
    ?.split(";")
    .map((v) => v.trim())
    .find((v) => v.startsWith(SESSION_COOKIE + "="))
    ?.slice(SESSION_COOKIE.length + 1);
}
export async function requireApiUser(request: Request, action: Action): Promise<SafeUser> {
  const user = await userFromToken(tokenFromRequest(request));
  if (!user) throw new AppError(401, "Entre para continuar.");
  assertPermission(user, action);
  return user;
}
export async function requirePageUser(action: Action): Promise<SafeUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword && action !== "account:password" && action !== "account:read")
    redirect("/change-password");
  try {
    assertPermission(user, action);
  } catch {
    redirect("/forbidden");
  }
  return user;
}
export async function logout(token: string | undefined) {
  if (!token) return;
  await prisma.$transaction(async (tx) => {
    const session = await tx.session.findUnique({ where: { tokenHash: hashToken(token) } });
    if (session) {
      await tx.session.delete({ where: { id: session.id } });
      await writeAudit(tx, {
        actorUserId: session.userId,
        action: "LOGOUT",
        entityType: "Session",
      });
    }
  });
}
export async function changePassword(actor: SafeUser, input: unknown) {
  const { currentPassword, newPassword } = passwordSchema.parse(input);
  if (currentPassword === newPassword)
    throw new AppError(400, "Escolha uma senha diferente da atual.");
  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction(
    async (tx) => {
      const user = await tx.user.findUniqueOrThrow({ where: { id: actor.id } });
      if (user.status !== UserStatus.ACTIVE) throw new AppError(401, "Entre para continuar.");
      if (!(await verifyPassword(currentPassword, user.passwordHash)))
        throw new AppError(400, "Senha atual inválida.");
      await tx.user.update({
        where: { id: user.id },
        data: { passwordHash, mustChangePassword: false, passwordChangedAt: new Date() },
      });
      await tx.session.deleteMany({ where: { userId: user.id } });
      await writeAudit(tx, {
        actorUserId: user.id,
        action: "PASSWORD_CHANGED",
        entityType: "User",
        entityId: user.id,
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
// Delivery and MFA verification remain explicit interfaces for later integration.
export interface PasswordRecoveryDelivery {
  send(userId: string, token: string): Promise<void>;
}
export interface MfaVerifier {
  verify(userId: string, code: string): Promise<boolean>;
}
export const futureMfaPolicy = {
  requiredProfile: AccessProfile.DIRECTION,
  enabled: false,
} as const;
export async function requestPasswordRecovery(email: string, delivery?: PasswordRecoveryDelivery) {
  if (!delivery) return;
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user || user.status !== UserStatus.ACTIVE) return;
  const token = randomBytes(32).toString("base64url");
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    },
  });
  await delivery.send(user.id, token);
}
