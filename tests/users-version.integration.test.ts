import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { authenticate, logout } from "@/modules/auth/service";
import { createUser, updateUser } from "@/modules/users/service";
import { safeUserSelect, type SafeUser } from "@/modules/users/types";
import { PATCH } from "@/app/api/users/[id]/route";
import { setOperationalUnit } from "@/modules/operations/service";

let direction: SafeUser;
const suffix = randomUUID();
let counter = 0;
function input() {
  const id = `version-${suffix}-${++counter}`;
  return {
    name: `Pessoa Fictícia Versão ${counter}`,
    email: `${id}@exemplo.invalid`,
    registrationNumber: id.slice(-40),
    functionalIdentifier: id.slice(-50),
    accessProfile: "INTERVIEWER" as const,
    professionalCategoryId: direction.professionalCategoryId,
    primaryUnitId: direction.primaryUnitId,
    status: "ACTIVE" as const,
  };
}
beforeAll(async () => {
  direction = await prisma.user.findUniqueOrThrow({
    where: { email: "direcao@cadflux.local" },
    select: safeUserSelect,
  });
});
afterAll(() => prisma.$disconnect());

describe("D02: versão administrativa de usuários", () => {
  it("recusa formulário antigo sem reativar usuário nem gravar auditoria parcial", async () => {
    const draft = input();
    const { user } = await createUser(direction, draft);
    const changed = await updateUser(direction, user.id, {
      ...draft,
      status: "INACTIVE",
      version: user.version,
    });
    const auditBefore = await prisma.auditLog.count({
      where: { entityType: "User", entityId: user.id },
    });
    await expect(
      updateUser(direction, user.id, {
        ...draft,
        name: "Nome antigo enviado depois",
        version: user.version,
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).toMatchObject({
      name: draft.name,
      status: "INACTIVE",
      version: changed.version,
    });
    expect(await prisma.auditLog.count({ where: { entityType: "User", entityId: user.id } })).toBe(
      auditBefore,
    );
  });

  it("preserva perfil e vínculos novos quando outra edição usa a versão anterior", async () => {
    const draft = input();
    const { user } = await createUser(direction, draft);
    const unit = await prisma.unit.create({
      data: { name: `Unidade Versão Fictícia ${suffix}`, code: `VERSION-${suffix.slice(0, 8)}` },
    });
    const currentDraft = {
      ...draft,
      accessProfile: "REFERRAL_OPERATOR" as const,
      additionalUnitIds: [unit.id],
    };
    const changed = await updateUser(direction, user.id, {
      ...currentDraft,
      version: user.version,
    });
    await expect(
      updateUser(direction, user.id, { ...draft, additionalUnitIds: [], version: user.version }),
    ).rejects.toMatchObject({ status: 409 });
    expect(await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).toMatchObject({
      accessProfile: "REFERRAL_OPERATOR",
      version: changed.version,
    });
    expect(await prisma.userUnitAccess.findMany({ where: { userId: user.id } })).toMatchObject([
      { unitId: unit.id },
    ]);
    const fresh = await updateUser(direction, user.id, {
      ...currentDraft,
      name: "Edição atual confirmada",
      version: changed.version,
    });
    expect(fresh.version).toBe(changed.version + 1);
  });

  it("exige versão na edição e não cria conflito por login ou alteração de preferência", async () => {
    const draft = input();
    const { user, temporaryPassword } = await createUser(direction, draft);
    await expect(updateUser(direction, user.id, draft)).rejects.toMatchObject({ name: "ZodError" });
    await prisma.user.update({
      where: { id: user.id },
      data: { mustChangePassword: false },
    });
    const auth = await authenticate({ email: user.email, password: temporaryPassword });
    await setOperationalUnit(auth.user, { unitId: user.primaryUnitId });
    const changed = await updateUser(direction, user.id, {
      ...draft,
      name: "Nome após login",
      version: user.version,
    });
    expect(changed.version).toBe(user.version + 1);
    await logout(auth.token);
  });

  it("API confirma no máximo uma edição concorrente da mesma versão", async () => {
    const draft = input();
    const { user } = await createUser(direction, draft);
    const auth = await authenticate({ email: direction.email, password: "CadFlux!Demo2026" });
    try {
      const responses = await Promise.all(
        ["Primeira edição", "Segunda edição"].map((name) =>
          PATCH(
            new Request(`http://127.0.0.1:3000/api/users/${user.id}`, {
              method: "PATCH",
              headers: {
                origin: "http://127.0.0.1:3000",
                cookie: `cadflux_session=${auth.token}`,
                "content-type": "application/json",
              },
              body: JSON.stringify({ ...draft, name, version: user.version }),
            }),
            { params: Promise.resolve({ id: user.id }) },
          ),
        ),
      );
      expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
      expect(await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).toMatchObject({
        version: user.version + 1,
      });
    } finally {
      await logout(auth.token);
    }
  });
});
