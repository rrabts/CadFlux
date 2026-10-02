import { describe, it, expect } from "vitest";
import {
  hashPassword,
  verifyPassword,
  hashToken,
  generateTemporaryPassword,
} from "@/modules/auth/password";
import { can } from "@/modules/permissions/service";
import { sanitizeAudit } from "@/modules/audit/service";
import { userInputSchema, isValidCpf, normalizeFunctionalIdentifier } from "@/modules/users/schema";
import type { SafeUser } from "@/modules/users/types";
const sample = {
  id: "one",
  status: "ACTIVE",
  mustChangePassword: false,
  primaryUnitId: "unit",
} as SafeUser;
describe("Autenticação e autorização", () => {
  it("hash salgado e verificação de senha", async () => {
    const a = await hashPassword("ficticia-123456");
    const b = await hashPassword("ficticia-123456");
    expect(a).not.toBe(b);
    expect(a).not.toContain("ficticia");
    expect(await verifyPassword("ficticia-123456", a)).toBe(true);
    expect(await verifyPassword("errada", a)).toBe(false);
    expect(await verifyPassword("errada", "malformado")).toBe(false);
  });
  it("tokens e senhas temporárias aleatórios", () => {
    expect(generateTemporaryPassword()).not.toBe(generateTemporaryPassword());
    expect(hashToken("session")).not.toContain("session");
  });
  for (const profile of ["INTERVIEWER", "REFERRAL_OPERATOR", "DIRECTION"] as const)
    it("permissões " + profile, () => {
      const user = { ...sample, accessProfile: profile };
      expect(can(user, "users:manage")).toBe(profile === "DIRECTION");
      expect(can(user, "dashboard:read")).toBe(true);
      expect(can({ ...user, status: "INACTIVE" }, "dashboard:read")).toBe(false);
      expect(can({ ...user, mustChangePassword: true }, "users:manage")).toBe(false);
      expect(can({ ...user, mustChangePassword: true }, "account:password")).toBe(true);
    });
  it("recurso de outro usuário/unidade é negado", () => {
    const user = { ...sample, accessProfile: "INTERVIEWER" } as SafeUser;
    expect(can(user, "account:read", { ownerUserId: "other" })).toBe(false);
    expect(can(user, "dashboard:read", { unitId: "other" })).toBe(false);
    expect(can(null, "dashboard:read")).toBe(false);
  });
  it("auditoria filtra segredos recursivamente", () => {
    const audit = sanitizeAudit({
      passwordHash: "secret",
      name: "Fictício",
      metadata: { token: "sensitive", total: 2 },
      users: [{ temporaryPassword: "sensitive", id: "1" }],
    });
    expect(JSON.stringify(audit)).not.toContain("sensitive");
    expect(JSON.stringify(audit)).not.toContain("secret");
    expect(audit).toMatchObject({ name: "Fictício", metadata: { total: 2 } });
  });
  it("normalização e CPF estrutural sem consulta externa", () => {
    expect(isValidCpf("11111111111")).toBe(false);
    expect(isValidCpf("12345678901")).toBe(false);
    expect(normalizeFunctionalIdentifier(" func-demo ")).toBe("FUNC-DEMO");
    expect(
      userInputSchema.safeParse({
        name: "Demo",
        email: "a@demo.local",
        registrationNumber: "m1",
        functionalIdentifier: "11111111111",
        accessProfile: "DIRECTION",
        professionalCategoryId: "c",
        primaryUnitId: "u",
        status: "ACTIVE",
      }).success,
    ).toBe(false);
  });
});
