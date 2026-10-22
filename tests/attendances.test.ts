import { describe, it, expect } from "vitest";
import { createAttendanceSchema, serviceDateSchema } from "@/modules/attendances/schema";
import { dateInTimezone, weekStart, permitsOpinion } from "@/modules/attendances/contracts";
import { assertAttendanceDate } from "@/modules/attendances/service";
const input = {
  serviceDate: "2026-10-19",
  name: "Pessoa Fictícia",
  cpf: "00000000191",
  responsibleRole: "RF",
  familyCode: "12345",
  phone: null,
  kind: "UPDATE_FAMILY",
  opinion: "PENDING",
  crowded: false,
};
describe("Regras de atendimento", () => {
  it("normaliza nome, CPF e telefone sem consulta externa", () => {
    const parsed = createAttendanceSchema.parse({
      ...input,
      cpf: "000.000.001-91",
      name: "  Pessoa   Fictícia  ",
      phone: "(22) 99999-0000",
    });
    expect(parsed.cpf).toBe("00000000191");
    expect(parsed.name).toBe("Pessoa Fictícia");
    expect(parsed.phone).toBe("22999990000");
  });
  for (const cpf of ["11111111111", "12345678901", "abc00000000191", "", "000000001919"])
    it("recusa CPF inválido: " + cpf, () =>
      expect(createAttendanceSchema.safeParse({ ...input, cpf }).success).toBe(false),
    );
  for (const serviceDate of ["2026-02-30", "2026-13-01", "01/10/2026", "1999-12-31"])
    it("recusa data inválida: " + serviceDate, () =>
      expect(serviceDateSchema.safeParse(serviceDate).success).toBe(false),
    );
  it("orientação dispensa código e inclusão não admite parecer", () => {
    expect(
      createAttendanceSchema.safeParse({
        ...input,
        kind: "GUIDANCE",
        familyCode: null,
        opinion: "WITHOUT",
      }).success,
    ).toBe(true);
    expect(
      createAttendanceSchema.safeParse({ ...input, kind: "GUIDANCE", opinion: "WITHOUT" }).success,
    ).toBe(false);
    for (const kind of [
      "INCLUDE_FAMILY",
      "INCLUDE_SINGLE_BF",
      "INCLUDE_SINGLE_BPC",
      "GUIDANCE",
    ] as const) {
      expect(permitsOpinion(kind)).toBe(false);
      expect(
        createAttendanceSchema.safeParse({
          ...input,
          kind,
          familyCode: kind === "GUIDANCE" ? null : "123",
          opinion: "WITH",
        }).success,
      ).toBe(false);
    }
    expect(createAttendanceSchema.safeParse({ ...input, familyCode: null }).success).toBe(false);
  });
  it("rejeita identidade institucional enviada e confirmação não booleana", () => {
    for (const extra of [
      { ownerUserId: "forged" },
      { unitId: "forged" },
      { version: 1 },
      { duplicateAcknowledged: "true" },
    ])
      expect(createAttendanceSchema.safeParse({ ...input, ...extra }).success).toBe(false);
  });
  it("semana usa a data civil da unidade inclusive na virada UTC", () => {
    expect(dateInTimezone(new Date("2026-10-19T02:30:00Z"), "America/Sao_Paulo")).toBe(
      "2026-10-18",
    );
    expect(weekStart("2026-10-18")).toBe("2026-10-12");
    const actor = { accessProfile: "INTERVIEWER" as const };
    expect(() =>
      assertAttendanceDate(
        "2026-10-18",
        "America/Sao_Paulo",
        actor,
        new Date("2026-10-19T02:30:00Z"),
      ),
    ).not.toThrow();
    expect(() =>
      assertAttendanceDate(
        "2026-10-18",
        "America/Sao_Paulo",
        actor,
        new Date("2026-10-19T03:00:00Z"),
      ),
    ).toThrow("semana");
    expect(() =>
      assertAttendanceDate(
        "2026-10-19",
        "America/Sao_Paulo",
        actor,
        new Date("2026-10-19T02:30:00Z"),
      ),
    ).toThrow("futura");
    expect(() =>
      assertAttendanceDate(
        "2026-10-12",
        "America/Sao_Paulo",
        { accessProfile: "DIRECTION" },
        new Date("2026-10-19T03:00:00Z"),
      ),
    ).not.toThrow();
  });
});
