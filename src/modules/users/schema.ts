import { AccessProfile, UserStatus } from "@prisma/client";
import { z } from "zod";

export function normalizeFunctionalIdentifier(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return /^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(trimmed)
    ? trimmed.replace(/\D/g, "")
    : trimmed.toUpperCase();
}
export function isValidCpf(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  if (!/^\d{11}$/.test(digits) || /^(\d)\1{10}$/.test(digits)) return false;
  for (const size of [9, 10]) {
    let sum = 0;
    for (let i = 0; i < size; i++) sum += Number(digits[i]) * (size + 1 - i);
    const check = ((sum * 10) % 11) % 10;
    if (check !== Number(digits[size])) return false;
  }
  return true;
}

export const userInputSchema = z
  .object({
    name: z.string().trim().min(2, "Informe o nome completo.").max(120),
    email: z
      .email("Informe um e-mail válido.")
      .max(254)
      .transform((value) => value.toLowerCase().trim()),
    registrationNumber: z
      .string()
      .trim()
      .min(1, "Informe a matrícula.")
      .max(40)
      .transform((v) => v.toUpperCase()),
    functionalIdentifier: z
      .string()
      .trim()
      .max(50)
      .optional()
      .nullable()
      .transform(normalizeFunctionalIdentifier)
      .refine((v) => !v || !/^\d{11}$/.test(v) || isValidCpf(v), "CPF estruturalmente inválido."),
    accessProfile: z.enum(AccessProfile),
    professionalCategoryId: z.string().min(1),
    primaryUnitId: z.string().min(1),
    status: z.enum(UserStatus).default(UserStatus.ACTIVE),
  })
  .strict();

export type UserInput = z.infer<typeof userInputSchema>;

export const userFiltersSchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  q: z.string().trim().max(120).optional(),
  profile: z.enum(AccessProfile).optional(),
  categoryId: z.string().max(100).optional(),
  unitId: z.string().max(100).optional(),
  status: z.enum(UserStatus).optional(),
});
