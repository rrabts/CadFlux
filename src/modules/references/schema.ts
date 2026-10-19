import { z } from "zod";

export const referenceKindSchema = z.enum(["units", "categories"]);
export type ReferenceKind = z.infer<typeof referenceKindSchema>;
const name = z
  .string()
  .trim()
  .min(2, "Informe um nome com ao menos dois caracteres.")
  .max(120)
  .transform((value) => value.replace(/\s+/gu, " "));
export const categoryInputSchema = z.object({ name, active: z.boolean().default(true) }).strict();
export const unitInputSchema = categoryInputSchema
  .extend({
    code: z
      .string()
      .trim()
      .min(1)
      .max(30)
      .regex(/^[a-zA-Z0-9_-]+$/, "Use letras, números, hífen ou sublinhado no código.")
      .transform((value) => value.toUpperCase()),
    timezone: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .refine((value) => {
        try {
          new Intl.DateTimeFormat("pt-BR", { timeZone: value });
          return true;
        } catch {
          return false;
        }
      }, "Informe um fuso horário válido, como America/Sao_Paulo."),
  })
  .strict();
export const referenceFiltersSchema = z
  .object({
    q: z.string().trim().max(120).optional(),
    status: z.enum(["active", "inactive"]).optional(),
    page: z.coerce.number().int().min(1).max(100000).default(1),
  })
  .strict();
