import { describe, expect, it } from "vitest";
import { isSameDatabase } from "@/lib/database-identity";

const development = "postgresql://demo:senha-ficticia@localhost:5432/cadflux";

describe("isolamento entre bancos de desenvolvimento e testes", () => {
  it("identifica aliases localhost/127.0.0.1 e protocolos PostgreSQL equivalentes", () => {
    const alias = "postgres://outro:outra-ficticia@127.0.0.1:5432/cadflux";
    expect(isSameDatabase(development, alias)).toBe(true);
    expect(isSameDatabase(alias, development)).toBe(true);
  });
  it("identifica porta 5432 omitida ou explícita", () => {
    expect(isSameDatabase(development, "postgres://demo:senha-ficticia@localhost/cadflux")).toBe(
      true,
    );
  });
  it("decodifica o nome antes de comparar bancos", () => {
    expect(isSameDatabase(development, "postgres://demo:senha-ficticia@127.0.0.1/%63adflux")).toBe(
      true,
    );
    expect(
      isSameDatabase(
        "postgres://demo:senha-ficticia@localhost/cadflux_test",
        "postgres://demo:senha-ficticia@127.0.0.1/cadflux%5Ftest",
      ),
    ).toBe(true);
  });
  it("credenciais e schemas diferentes continuam identificando o mesmo banco físico", () => {
    expect(
      isSameDatabase(
        development + "?schema=public",
        "postgres://outro:outra-ficticia@127.0.0.1:5432/cadflux?schema=teste&sslmode=require",
      ),
    ).toBe(true);
  });
  it("normaliza capitalização e ponto final do hostname", () => {
    expect(isSameDatabase(development, "postgres://demo:senha-ficticia@LOCALHOST./cadflux")).toBe(
      true,
    );
  });
  it.each([
    "postgres://demo:senha-ficticia@localhost/cadflux_test",
    "postgres://demo:senha-ficticia@localhost/CadFlux",
    "postgres://demo:senha-ficticia@localhost:5433/cadflux",
    "postgres://demo:senha-ficticia@outro-host.invalid:5432/cadflux",
  ])("permite um banco distinto %s", (test) => {
    expect(isSameDatabase(development, test)).toBe(false);
  });
  it.each([
    "https://localhost/cadflux",
    "sqlite://localhost/cadflux",
    "endereço inválido",
    "postgres:///cadflux",
    "postgres://localhost/",
    "postgres://localhost/%ZZ",
    "postgres://localhost/cadflux%00",
    "postgres://localhost:0/cadflux",
  ])("recusa endereço incompatível %s", (invalid) => {
    expect(() => isSameDatabase(development, invalid)).toThrow(/URL PostgreSQL válida/);
    expect(() => isSameDatabase(invalid, development)).toThrow(/URL PostgreSQL válida/);
  });
});
