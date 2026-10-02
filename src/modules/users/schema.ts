import { validIdentifier, normalizeIdentifier } from "./identifier";
import { AccessProfile, UserStatus } from "@prisma/client";
import { z } from "zod";

export const userInputSchema = z
  .object({
    name: z.string().trim().min(2, "Informe o nome completo.").max(120),
    email: z
      .email("Informe um e-mail válido.")
      .max(254)
      .transform((value) => value.toLowerCase().trim()),
    registrationNumber: z.string().trim().min(1, "Informe a matrícula.").max(40),
    functionalIdentifier: z
      .string()
      .trim()
      .max(50)
      .refine(validIdentifier, "CPF ou identificador inválido.")
      .transform(normalizeIdentifier)
      .optional()
      .nullable()
      .transform((value) => value || null),
    accessProfile: z.enum(AccessProfile),
    professionalCategoryId: z.string().min(1),
    primaryUnitId: z.string().min(1),
    status: z.enum(UserStatus).default(UserStatus.ACTIVE),
  })
  .strict();

export type UserInput = z.infer<typeof userInputSchema>;

export const userFiltersSchema = z.object({
  q: z.string().trim().max(120).optional(),
  profile: z.enum(AccessProfile).optional(),
  categoryId: z.string().max(100).optional(),
  unitId: z.string().max(100).optional(),
  status: z.enum(UserStatus).optional(),
});
