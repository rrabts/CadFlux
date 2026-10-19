import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { isSameDatabase } from "../src/lib/database-identity";

async function createUnitThroughUi(page: Page, name: string, code: string) {
  await page.goto("/units");
  await page.getByRole("button", { name: "Nova unidade", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel(/^Nome/).fill(name);
  await dialog.getByLabel(/^Código/).fill(code);
  await dialog.getByRole("button", { name: "Salvar cadastro", exact: true }).click();
  await expect(dialog).toHaveCount(0);
}

test("Fase 2: Direção mantém unidades e consulta histórico", async ({ page }) => {
  await login(page);
  await expect(page).toHaveURL(/\/dashboard/);
  const id = randomUUID().slice(0, 8);
  const name = "Unidade Fictícia UI " + id;
  await createUnitThroughUi(page, name, "UI-F2-" + id);
  await page.getByLabel("Pesquisar", { exact: true }).fill(name);
  await page.getByRole("button", { name: "Filtrar", exact: true }).click();
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.getByRole("button", { name: "Editar " + name, exact: true }).click();
  await page.getByRole("dialog").getByLabel("Fuso horário").fill("America/Manaus");
  await page.getByRole("dialog").getByRole("button", { name: "Salvar cadastro" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("tbody")).toContainText("America/Manaus");
  await page.getByRole("button", { name: "Inativar " + name, exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Inativar", exact: true }).click();
  await expect(page.getByRole("button", { name: "Ativar " + name, exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Ativar " + name, exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Ativar", exact: true }).click();
  await expect(page.getByRole("button", { name: "Inativar " + name, exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Histórico " + name, exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Unidade criada");
  await expect(page.getByRole("dialog")).toContainText("Unidade inativada");
  await page.getByRole("button", { name: "Fechar janela" }).click();
  await page.screenshot({
    animations: "disabled",
    path: ".local/evidence/phase-2-units.png",
    fullPage: true,
  });
});

test("Fase 2: unidades adicionais persistem e impedem inativação com usuário ativo", async ({
  page,
}) => {
  await login(page);
  await expect(page).toHaveURL(/\/dashboard/);
  const id = randomUUID().slice(0, 8);
  const unitName = "Unidade Adicional UI " + id;
  await createUnitThroughUi(page, unitName, "UI-ADD-" + id);
  await page.goto("/users/new");
  await page.getByLabel("Nome completo").fill("Pessoa Fictícia Vínculo " + id);
  await page.getByLabel(/^E-mail/).fill("ui-add-" + id + "@exemplo.invalid");
  await page.getByLabel(/^Matrícula/).fill("UI-ADD-" + id);
  await page
    .getByLabel(/^Unidade principal/)
    .selectOption({ label: "Unidade Central — Demonstração" });
  await page.getByRole("checkbox", { name: unitName, exact: true }).check();
  await page.getByRole("button", { name: "Criar usuário", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Abrir usuário", exact: true }).click();
  await expect(page.getByRole("tab", { name: "Unidade", exact: true })).toBeVisible();
  const detailUrl = page.url();
  await page.getByRole("tab", { name: "Unidade", exact: true }).click();
  await expect(page.getByRole("checkbox", { name: unitName, exact: true })).toBeChecked();
  await page.screenshot({
    animations: "disabled",
    path: ".local/evidence/phase-2-user-units.png",
    fullPage: true,
  });
  await page.goto("/units");
  await page.getByLabel("Pesquisar", { exact: true }).fill(unitName);
  await page.getByRole("button", { name: "Filtrar", exact: true }).click();
  await page.getByRole("button", { name: "Inativar " + unitName, exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Inativar", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Existem usuários ativos vinculados" }),
  ).toContainText("Existem usuários ativos vinculados");
  await page.goto(detailUrl);
  await page.getByRole("tab", { name: "Unidade", exact: true }).click();
  await page.getByRole("checkbox", { name: unitName, exact: true }).uncheck();
  const saved = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname.startsWith("/api/users/") &&
      response.request().method() === "PATCH",
  );
  await page.getByRole("button", { name: "Salvar alterações", exact: true }).click();
  expect((await saved).status()).toBe(200);
  await page.reload();
  await page.getByRole("tab", { name: "Unidade", exact: true }).click();
  await expect(page.getByRole("checkbox", { name: unitName, exact: true })).not.toBeChecked();
});

test("Fase 2: categoria no mobile, duplicidade e histórico", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto("/categories");
  const name = "Categoria Fictícia Mobile " + randomUUID().slice(0, 8);
  await page.getByRole("button", { name: "Nova categoria", exact: true }).click();
  await page.getByRole("dialog").getByLabel(/^Nome/).fill(name);
  await page.getByRole("dialog").getByRole("button", { name: "Salvar cadastro" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Nova categoria", exact: true }).click();
  await page.getByRole("dialog").getByLabel(/^Nome/).fill(name.toUpperCase());
  await page.getByRole("dialog").getByRole("button", { name: "Salvar cadastro" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "Já existe uma categoria",
  );
  await page.getByRole("dialog").getByRole("button", { name: "Cancelar", exact: true }).click();
  await page.getByLabel("Pesquisar", { exact: true }).fill(name);
  await page.getByRole("button", { name: "Filtrar", exact: true }).click();
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
  await page.screenshot({
    animations: "disabled",
    path: ".local/evidence/phase-2-categories-mobile.png",
    fullPage: true,
  });
});
const password = "CadFlux!Demo2026";
async function createPaginationFixture() {
  const testUrl = process.env.DATABASE_URL_TEST;
  const developmentUrl = process.env.DATABASE_URL;
  if (!testUrl || !developmentUrl)
    throw new Error("Configure bancos separados antes de criar a fixture de interface.");
  if (isSameDatabase(testUrl, developmentUrl))
    throw new Error("A fixture exige o banco de testes separado.");
  const fixture = new PrismaClient({ datasourceUrl: testUrl });
  const id = randomUUID().slice(0, 13);
  const prefix = "Paginação UI " + id;
  try {
    const seed = await fixture.user.findUniqueOrThrow({
      where: { email: "direcao@cadflux.local" },
    });
    await fixture.user.createMany({
      data: Array.from({ length: 51 }, (_, index) => ({
        name: prefix + " " + String(index).padStart(2, "0"),
        email: "page-ui-" + id + "-" + index + "@cadflux.local",
        registrationNumber: "PGUI-" + id + "-" + index,
        functionalIdentifier: "FUNC-PGUI-" + id + "-" + index,
        passwordHash: seed.passwordHash,
        accessProfile: "INTERVIEWER" as const,
        professionalCategoryId: seed.professionalCategoryId,
        primaryUnitId: seed.primaryUnitId,
        status: "ACTIVE" as const,
        mustChangePassword: true,
      })),
    });
  } finally {
    await fixture.$disconnect();
  }
  return prefix;
}

async function login(page: Page, email = "direcao@cadflux.local", secret = password) {
  await page.goto("/login");
  await page.getByLabel(/^E-mail/).fill(email);
  await page.getByLabel(/^Senha/).fill(secret);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
}
async function logout(page: Page) {
  await page.getByRole("button", { name: "Menu do perfil" }).click();
  await page.getByRole("menuitem", { name: "Sair", exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
}
test("rotas protegidas exigem sessão e login inválido exibe erro textual", async ({ page }) => {
  await page.goto("/users");
  await expect(page).toHaveURL(/\/login/);
  const loginResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/auth/login" &&
      response.request().method() === "POST",
  );
  await login(page, "direcao@cadflux.local", "incorreta");
  expect((await loginResponse).status()).toBe(401);
  await expect(
    page.getByRole("alert").filter({ hasText: "E-mail ou senha inválidos" }),
  ).toContainText("E-mail ou senha inválidos");
});
for (const profile of [
  { email: "direcao@cadflux.local", menu: "Gestão de usuários", excluded: "Meus atendimentos" },
  {
    email: "entrevistador@cadflux.local",
    menu: "Meus atendimentos",
    excluded: "Gestão de usuários",
  },
  {
    email: "encaminhador@cadflux.local",
    menu: "Meus encaminhamentos",
    excluded: "Gestão de usuários",
  },
]) {
  test("menus e logout: " + profile.email, async ({ page }) => {
    await login(page, profile.email);
    await expect(page).toHaveURL(/\/dashboard/);
    const navigation = page.getByRole("navigation", { name: "Navegação principal" });
    await expect(navigation.getByRole("link", { name: profile.menu, exact: true })).toBeVisible();
    await expect(navigation.getByRole("link", { name: profile.excluded, exact: true })).toHaveCount(
      0,
    );
    if (profile.email !== "direcao@cadflux.local") {
      await page.goto("/users");
      await expect(page.getByRole("heading", { name: "Acesso não permitido" })).toBeVisible();
    }
    await logout(page);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });
}
test("temas claro, escuro e sistema persistem e a navegação recolhe", async ({ page }) => {
  await login(page);
  await expect(page).toHaveURL(/\/dashboard/);
  await page.getByRole("button", { name: "Selecionar tema" }).click();
  await page.getByRole("menuitem", { name: "Escuro", exact: true }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.screenshot({
    animations: "disabled",
    path: ".local/evidence/dashboard-dark.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Selecionar tema" }).click();
  await page.getByRole("menuitem", { name: "Claro", exact: true }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await page.screenshot({
    animations: "disabled",
    path: ".local/evidence/dashboard-light.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Selecionar tema" }).click();
  await page.getByRole("menuitem", { name: "Sistema", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("cadflux-theme")))
    .toBe("system");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("cadflux-theme")))
    .toBe("system");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("cadflux-theme")))
    .toBe("system");
  await page.getByRole("button", { name: "Recolher navegação" }).click();
  await expect(page.locator(".app-shell")).toHaveClass(/sidebar-collapsed/);
  await page.getByRole("button", { name: "Expandir navegação" }).click();
  await expect(page.locator(".app-shell")).not.toHaveClass(/sidebar-collapsed/);
  await page.screenshot({
    animations: "disabled",
    path: ".local/evidence/dashboard-desktop.png",
    fullPage: true,
  });
});
test("mobile tem drawer utilizável por teclado e não excede largura da tela", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole("button", { name: "Abrir menu" })).toBeVisible();
  await page.getByRole("button", { name: "Abrir menu" }).click();
  await expect(page.getByRole("button", { name: "Abrir menu" })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await page
    .getByRole("navigation", { name: "Navegação principal" })
    .getByRole("link", { name: "Gestão de usuários", exact: true })
    .click();
  await expect(page).toHaveURL(/\/users/);
  await expect(page.getByRole("button", { name: "Abrir menu" })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
  await page.getByRole("button", { name: "Abrir menu" }).click();
  await expect(page.getByRole("link", { name: "CadFlux, visão geral" })).toBeFocused();
  await page.screenshot({
    animations: "disabled",
    path: ".local/evidence/navigation-mobile.png",
    fullPage: false,
  });
  await page.keyboard.press("Shift+Tab");
  await expect(
    page
      .getByRole("navigation", { name: "Navegação principal" })
      .getByRole("link", { name: "Meu perfil", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "CadFlux, visão geral" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Abrir menu" })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  await page.screenshot({
    animations: "disabled",
    path: ".local/evidence/users-mobile.png",
    fullPage: true,
  });
});
test("Direção cria, edita, troca vínculos, inativa e consulta histórico", async ({ page }) => {
  await login(page);
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto("/users/new");
  const id = Date.now().toString();
  await page.getByLabel("Nome completo").fill("Pessoa Fictícia UI " + id);
  await page.getByLabel(/^E-mail/).fill("ui-" + id + "@cadflux.local");
  await page.getByLabel(/^Matrícula/).fill("UI-" + id);
  await page.getByLabel("CPF ou identificador funcional").fill("FUNC-UI-" + id);
  await page.getByRole("button", { name: "Criar usuário", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog")).toContainText("Senha temporária");
  await page.getByRole("button", { name: "Abrir usuário", exact: true }).click();
  await expect(page.getByRole("tab", { name: "Dados pessoais" })).toBeVisible();
  await page.getByLabel("Nome completo").fill("Pessoa Fictícia Editada " + id);
  await page.getByRole("tab", { name: "Acesso e perfil" }).click();
  await page.getByLabel("Perfil de acesso").selectOption("REFERRAL_OPERATOR");
  await page.getByLabel("Categoria profissional").selectOption({ label: "Assistente Social" });
  await page.getByRole("tab", { name: "Unidade", exact: true }).click();
  await page
    .getByLabel("Unidade principal")
    .selectOption({ label: "Unidade Norte — Demonstração" });
  await page.getByRole("button", { name: "Salvar alterações", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Pessoa Fictícia Editada " + id);
  await page.getByRole("button", { name: "Inativar usuário", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Inativar", exact: true }).click();
  await expect(page.getByRole("button", { name: "Ativar usuário", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Histórico", exact: true }).click();
  await expect(page.locator(".data-table tbody tr").first()).toBeVisible();
  await expect(page.locator(".data-table")).toContainText("Direção Fictícia");
});
test("importação mostra erro antes da confirmação e confirma CSV válido", async ({ page }) => {
  await login(page);
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto("/users/import");
  const id = Date.now().toString();
  const header = "nome,cpf_ou_identificador,email,matricula,perfil,categoria,unidade,status\n";
  await page.getByLabel("Arquivo de usuários").setInputFiles({
    name: "invalido.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      header +
        "Pessoa Fictícia,,invalid-" +
        id +
        "@cadflux.local,INVALID-" +
        id +
        ",ADMIN,Entrevistador,DEMO-CENTRAL,ACTIVE",
    ),
  });
  const previewResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/imports/preview" &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Validar arquivo", exact: true }).click();
  expect((await previewResponse).status()).toBe(200);
  await expect(
    page.getByRole("button", { name: "Confirmar importação", exact: true }),
  ).toBeDisabled();
  await expect(page.locator(".error-list")).toContainText(/perfil/i);
  await page.getByRole("button", { name: "Trocar arquivo", exact: true }).click();
  await page.getByLabel("Arquivo de usuários").setInputFiles({
    name: "valido.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      header +
        "Pessoa Importada UI,FUNC-IMPORT-" +
        id +
        ",import-" +
        id +
        "@cadflux.local,IMPORT-" +
        id +
        ",INTERVIEWER,Entrevistador,DEMO-CENTRAL,ACTIVE",
    ),
  });
  await page.getByRole("button", { name: "Validar arquivo", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Confirmar importação", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Confirmar importação", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Criar usuários", exact: true })
    .click();
  await expect(page.getByRole("heading", { name: "Senhas temporárias" })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("1 usuário criado com sucesso");
});
test("senha temporária obriga troca e nova autenticação", async ({ page, request }) => {
  await login(page);
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto("/users/new");
  const id = Date.now().toString();
  const email = "password-" + id + "@cadflux.local";
  await page.getByLabel("Nome completo").fill("Senha Fictícia " + id);
  await page.getByLabel(/^E-mail/).fill(email);
  await page.getByLabel(/^Matrícula/).fill("PWD-" + id);
  await page.getByRole("button", { name: "Criar usuário", exact: true }).click();
  const temporary = await page.getByRole("dialog").locator("code").innerText();
  await page.getByRole("button", { name: "Abrir usuário", exact: true }).click();
  await logout(page);
  await login(page, email, temporary);
  await expect(page).toHaveURL(/\/change-password/);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/change-password/);
  await page.getByLabel("Senha atual").fill(temporary);
  await page.getByLabel(/^Nova senha/).fill("NovaSenha!Ficticia2026");
  await page.getByLabel("Confirmar nova senha").fill("NovaSenha!Ficticia2026");
  await page.getByRole("button", { name: "Alterar senha", exact: true }).click();
  await expect(page).toHaveURL(/\/login\?password=changed/);
  await expect(page.getByRole("status")).toContainText("Senha alterada");
  await login(page, email, "NovaSenha!Ficticia2026");
  await expect(page).toHaveURL(/\/dashboard/);
  const response = await request.get("/api/users");
  expect(response.status()).toBe(401);
});

test("gestão pagina sem perder registros e filtros retornam à primeira página", async ({
  page,
}) => {
  const prefix = await createPaginationFixture();
  await login(page);
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto("/users");
  await page.getByLabel("Pesquisar").fill(prefix);
  await page.getByRole("button", { name: "Filtrar", exact: true }).click();
  await expect(page.locator(".table-footer")).toContainText(/Mostrando 1–50 de/);
  const firstNames = await page.locator(".user-cell strong").allTextContents();
  await page.getByRole("button", { name: "Próxima", exact: true }).click();
  await expect(page.locator(".table-footer")).toContainText(/Mostrando 51–/);
  const secondNames = await page.locator(".user-cell strong").allTextContents();
  expect(secondNames.length).toBeGreaterThan(0);
  expect(secondNames.some((name) => firstNames.includes(name))).toBe(false);
  await page.getByLabel("Pesquisar").fill("Direção Fictícia");
  await page.getByRole("button", { name: "Filtrar", exact: true }).click();
  await expect(page.locator(".table-footer")).toContainText("Mostrando 1–1 de 1");
  await expect(page.getByRole("button", { name: "Anterior", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Próxima", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Limpar", exact: true }).click();
  await expect(page.locator(".table-footer")).toContainText(/Mostrando 1–50 de/);
  await expect(page.getByRole("button", { name: "Anterior", exact: true })).toBeDisabled();
  await page.screenshot({
    animations: "disabled",
    path: ".local/evidence/users-desktop-pagination.png",
    fullPage: true,
  });
});
