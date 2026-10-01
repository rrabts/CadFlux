import { AccessProfile, UserStatus } from "@prisma/client";
import { AppError } from "@/lib/errors";
import type { SafeUser } from "@/modules/users/types";

export type Action = "dashboard:read" | "reference:read" | "users:read" | "users:manage" | "audit:read" | "account:read" | "account:password";
export type ResourceScope = { ownerUserId?: string; unitId?: string };

const grants: Record<AccessProfile, readonly Action[]> = {
  INTERVIEWER: ["dashboard:read", "account:read", "account:password"],
  REFERRAL_OPERATOR: ["dashboard:read", "account:read", "account:password"],
  DIRECTION: ["dashboard:read", "reference:read", "users:read", "users:manage", "audit:read", "account:read", "account:password"],
};

export function can(user: SafeUser | null, action: Action, resource?: ResourceScope): boolean {
  if (!user || user.status !== UserStatus.ACTIVE) return false;
  if (user.mustChangePassword && action !== "account:password" && action !== "account:read") return false;
  if (!grants[user.accessProfile].includes(action)) return false;
  if (resource?.ownerUserId && resource.ownerUserId !== user.id && user.accessProfile !== AccessProfile.DIRECTION) return false;
  if (resource?.unitId && resource.unitId !== user.primaryUnitId && user.accessProfile !== AccessProfile.DIRECTION) return false;
  return true;
}

export function assertPermission(user: SafeUser, action: Action, resource?: ResourceScope): void {
  if (user.mustChangePassword && action !== "account:password" && action !== "account:read") {
    throw new AppError(428, "Altere sua senha temporária para continuar.");
  }
  if (!can(user, action, resource)) throw new AppError(403, "Você não possui permissão para esta operação.");
}
