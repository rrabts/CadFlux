import { z } from "zod";
export const unitSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    code: z
      .string()
      .trim()
      .regex(/^[A-Z0-9_-]{1,30}$/),
    active: z.boolean(),
    timezone: z.string().refine((value) => {
      try {
        new Intl.DateTimeFormat("pt-BR", { timeZone: value });
        return true;
      } catch {
        return false;
      }
    }, "Fuso horário inválido"),
  })
  .strict();
