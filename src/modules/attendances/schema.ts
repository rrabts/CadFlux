import { z } from "zod";
import { isValidCpf } from "@/modules/users/schema";
import { kindLabels, opinionLabels, permitsOpinion } from "./contracts";
export const serviceDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data válida.")
  .refine((v) => {
    const date = new Date(v + "T00:00:00Z");
    return (
      !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === v && v >= "2000-01-01"
    );
  }, "Informe uma data válida a partir de 2000.");
export const cpfSchema = z
  .string()
  .trim()
  .max(14)
  .regex(/^[\d.\-]+$/, "Informe um CPF válido.")
  .transform((v) => v.replace(/\D/g, ""))
  .refine(isValidCpf, "CPF estruturalmente inválido.");
const fields = {
  benefitIds: z
    .array(z.string().min(1).max(100))
    .max(100)
    .refine((ids) => new Set(ids).size === ids.length, "Benefícios repetidos.")
    .optional(),
  serviceDate: serviceDateSchema,
  name: z
    .string()
    .trim()
    .min(2, "Informe o nome completo.")
    .max(120)
    .transform((v) => v.replace(/\s+/g, " ")),
  cpf: cpfSchema,
  responsibleRole: z.enum(["RF", "RL"]),
  familyCode: z
    .string()
    .trim()
    .max(20)
    .regex(/^\d*$/, "O código familiar deve conter apenas números.")
    .nullable()
    .transform((v) => v || null),
  phone: z
    .string()
    .trim()
    .max(25)
    .regex(/^[\d\s()+\-]*$/, "Telefone inválido.")
    .nullable()
    .transform((v) => v?.replace(/\D/g, "") || null)
    .refine((v) => !v || /^\d{10,11}$/.test(v), "Informe telefone com DDD (10 ou 11 dígitos)."),
  kind: z.enum(
    Object.keys(kindLabels) as [keyof typeof kindLabels, ...(keyof typeof kindLabels)[]],
  ),
  opinion: z.enum(
    Object.keys(opinionLabels) as [keyof typeof opinionLabels, ...(keyof typeof opinionLabels)[]],
  ),
  crowded: z.boolean(),
};
const baseSchema = z.object(fields);
function checkCombination(input: z.infer<typeof baseSchema>, ctx: z.RefinementCtx) {
  if (input.kind !== "GUIDANCE" && !input.familyCode)
    ctx.addIssue({ code: "custom", path: ["familyCode"], message: "Informe o código familiar." });
  if (input.kind === "GUIDANCE" && input.familyCode)
    ctx.addIssue({
      code: "custom",
      path: ["familyCode"],
      message: "Orientação não utiliza código familiar.",
    });
  if (!permitsOpinion(input.kind) && input.opinion !== "WITHOUT")
    ctx.addIssue({
      code: "custom",
      path: ["opinion"],
      message: "Inclusão e orientação não admitem parecer.",
    });
}
export const createAttendanceSchema = baseSchema
  .extend({
    unitId: z.string().min(1).max(100).optional(),
    duplicateAcknowledged: z.boolean().default(false),
  })
  .strict()
  .superRefine(checkCombination);
export const updateAttendanceSchema = baseSchema
  .extend({ version: z.number().int().min(1), duplicateAcknowledged: z.boolean().default(false) })
  .strict()
  .superRefine(checkCombination);
export const cancelAttendanceSchema = z
  .object({
    version: z.number().int().min(1),
    reason: z.string().trim().min(5, "Descreva o motivo com pelo menos cinco caracteres.").max(500),
  })
  .strict();
export const attendanceFiltersSchema = z
  .object({
    q: z.string().trim().max(120).optional(),
    from: serviceDateSchema.optional(),
    to: serviceDateSchema.optional(),
    kind: fields.kind.optional(),
    opinion: fields.opinion.optional(),
    status: z.enum(["active", "cancelled", "all"]).default("active"),
    page: z.coerce.number().int().min(1).max(100000).default(1),
    ownerUserId: z.string().max(100).optional(),
    unitId: z.string().max(100).optional(),
  })
  .strict()
  .refine((v) => !v.from || !v.to || v.from <= v.to, {
    path: ["to"],
    message: "A data final deve ser igual ou posterior à inicial.",
  });
