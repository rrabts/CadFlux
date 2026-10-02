import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../../src/modules/auth/password";
const db = new PrismaClient();
const password = "Browser!Test2026";
test.beforeAll(async () => {
  if (!process.env.DATABASE_URL || !new URL(process.env.DATABASE_URL).pathname.endsWith("_test"))
    throw new Error("Banco exclusivo de testes requerido");
  execFileSync("pnpm", ["db:seed"], { env: process.env, stdio: "pipe" });
  const passwordHash = await hashPassword(password);
  await db.user.updateMany({
    where: {
      email: {
        in: ["direcao@cadflux.local", "entrevistador@cadflux.local", "encaminhador@cadflux.local"],
      },
    },
    data: { passwordHash, mustChangePassword: false, status: "ACTIVE" },
  });
});
test.afterAll(async () => {
  await db.user.updateMany({
    where: {
      email: {
        in: ["direcao@cadflux.local", "entrevistador@cadflux.local", "encaminhador@cadflux.local"],
      },
    },
    data: {
      passwordHash: await hashPassword("CadFlux!Dev2026"),
      mustChangePassword: true,
      status: "ACTIVE",
    },
  });
  await db.$disconnect();
});
async function signIn(page: import("@playwright/test").Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail ou matrícula").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
}
test("rotas protegidas, login inválido e CSRF", async ({ page, request }) => {
  await page.goto("/users");
  await expect(page).toHaveURL(/login/);
  await page.getByLabel("E-mail ou matrícula").fill("direcao@cadflux.local");
  await page.getByLabel("Senha", { exact: true }).fill("incorreta");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByText("Usuário ou senha inválidos.")).toBeVisible();
  const response = await request.post("/api/auth/login", {
    data: { login: "direcao@cadflux.local", password },
    headers: { Origin: "https://evil.example" },
  });
  expect(response.status()).toBe(403);
});
for (const email of ["entrevistador@cadflux.local", "encaminhador@cadflux.local"])
  test(`${email}: bloqueio direto de gestão e menu`, async ({ page }) => {
    await signIn(page, email);
    await expect(page.getByRole("link", { name: "Gestão de usuários", exact: true })).toHaveCount(
      0,
    );
    await page.goto("/users");
    await expect(page.getByRole("heading", { name: "Acesso não permitido" })).toBeVisible();
    expect((await page.request.get("/api/users")).status()).toBe(403);
  });
test("Direção, tema persistido, sidebar, mobile e logout", async ({ page }) => {
  await signIn(page, "direcao@cadflux.local");
  await page.getByRole("link", { name: "Gestão de usuários", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Gestão de usuários", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("table")).toBeVisible();
  await page.getByRole("button", { name: "Selecionar tema" }).click();
  await page.getByRole("menuitem", { name: "Escuro" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.getByRole("button", { name: "Selecionar tema" }).click();
  await page.getByRole("menuitem", { name: "Claro" }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await page.getByRole("button", { name: "Recolher menu" }).click();
  await expect(page.getByRole("button", { name: "Expandir menu" })).toBeVisible();
  await page.screenshot({ path: "test-results/direction-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Abrir menu" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.screenshot({ path: "test-results/direction-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "Menu do perfil" }).click();
  await page.getByRole("menuitem", { name: "Sair" }).click();
  await expect(page).toHaveURL(/login/);
  expect((await page.request.get("/api/users")).status()).toBe(401);
});
test("inativação revoga sessão em rota e API", async ({ page }) => {
  await signIn(page, "entrevistador@cadflux.local");
  await db.user.update({
    where: { email: "entrevistador@cadflux.local" },
    data: { status: "INACTIVE" },
  });
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/login/);
  expect((await page.request.get("/api/auth/me")).status()).toBe(401);
  await db.user.update({
    where: { email: "entrevistador@cadflux.local" },
    data: { status: "ACTIVE" },
  });
});
test("gestão pela interface e importação revisada", async ({ page }) => {
  const suffix = Date.now().toString();
  await signIn(page, "direcao@cadflux.local");
  await page.goto("/users");
  await expect(page.getByRole("table")).toBeVisible();
  await page.getByRole("button", { name: "+ Novo usuário", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nome", { exact: true }).fill(`Fictício Navegador ${suffix}`);
  await dialog.getByLabel("E-mail", { exact: true }).fill(`browser-${suffix}@cadflux.local`);
  await dialog.getByLabel("Matrícula", { exact: true }).fill(`WEB-${suffix}`);
  await dialog.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(dialog.getByText(/Usuário criado/)).toBeVisible();
  await dialog.getByRole("button", { name: "Fechar janela" }).click();
  await page.getByLabel("Buscar", { exact: true }).fill(`WEB-${suffix}`);
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  const row = page.getByRole("row").filter({ hasText: `WEB-${suffix}` });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Detalhes" }).click();
  await dialog.getByLabel("Nome", { exact: true }).fill(`Fictício Editado ${suffix}`);
  await dialog.getByRole("tab", { name: "Acesso e perfil" }).click();
  await dialog.getByLabel("Perfil de acesso").selectOption("REFERRAL_OPERATOR");
  await dialog.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(row).toContainText("Encaminhador");
  await row.getByRole("button", { name: "Inativar", exact: true }).click();
  await dialog.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(row).toContainText("Inativo");
  await row.getByRole("button", { name: "Ativar", exact: true }).click();
  await dialog.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(row).toContainText("Ativo");
  await page.goto("/users/import");
  const csv =
    "nome,cpf_ou_identificador,email,matricula,perfil,categoria,unidade,status\n" +
    `Importado Fictício,,import-${suffix}@cadflux.local,IMP-${suffix},INTERVIEWER,Entrevistador,DEMO-01,ACTIVE\n`;
  await page
    .getByLabel("Arquivo de usuários")
    .setInputFiles({ name: "usuarios.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await page.getByRole("button", { name: "Validar arquivo" }).click();
  await expect(page.getByRole("heading", { name: "Revise antes de confirmar" })).toBeVisible();
  expect(
    await db.user.findUnique({ where: { email: `import-${suffix}@cadflux.local` } }),
  ).toBeNull();
  await page.getByRole("button", { name: "Confirmar importação", exact: true }).click();
  await dialog.getByRole("button", { name: "Importar usuários", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Importação concluída" })).toBeVisible();
});
test("senha temporária obriga troca e encerra sessão", async ({ page }) => {
  const email = "encaminhador@cadflux.local";
  await db.user.update({ where: { email }, data: { mustChangePassword: true } });
  await page.goto("/login");
  await page.getByLabel("E-mail ou matrícula").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/profile/);
  await expect(
    page.getByText("Altere sua senha temporária para acessar os módulos."),
  ).toBeVisible();
  await page.getByLabel("Senha atual").fill(password);
  await page
    .getByLabel("Nova senha (mínimo 12 caracteres)", { exact: true })
    .fill("Changed!Password2026");
  await page.getByLabel("Confirme a nova senha").fill("Changed!Password2026");
  await page.getByRole("button", { name: "Alterar senha", exact: true }).click();
  await expect(page).toHaveURL(/login/);
  await expect
    .poll(async () => (await db.user.findUniqueOrThrow({ where: { email } })).mustChangePassword)
    .toBe(false);
});

test("acessibilidade das telas principais", async ({ page }) => {
  await page.goto("/login");
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze())
      .violations,
  ).toEqual([]);
  await signIn(page, "direcao@cadflux.local");
  await page.goto("/users");
  await expect(page.getByRole("table")).toBeVisible();
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze())
      .violations,
  ).toEqual([]);
  await page.getByRole("button", { name: "+ Novo usuário", exact: true }).click();
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze())
      .violations,
  ).toEqual([]);
});
