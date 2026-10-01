import type { Prisma } from "@prisma/client";

export const safeUserSelect = {
  id: true,
  name: true,
  email: true,
  registrationNumber: true,
  functionalIdentifier: true,
  accessProfile: true,
  professionalCategoryId: true,
  primaryUnitId: true,
  status: true,
  mustChangePassword: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  professionalCategory: { select: { id: true, name: true } },
  primaryUnit: { select: { id: true, name: true, code: true } },
} satisfies Prisma.UserSelect;

export type SafeUser = Prisma.UserGetPayload<{ select: typeof safeUserSelect }>;
