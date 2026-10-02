import { userInputSchema, normalizeFunctionalIdentifier, isValidCpf } from "@/modules/users/schema";
import type { ImportPreviewRow, ImportReferences, ParsedImportRow } from "./types";

const key = (value: string) => value.trim().toLocaleLowerCase("pt-BR");

export function validateImportRows(
  rows: ParsedImportRow[],
  references: ImportReferences,
): ImportPreviewRow[] {
  const frequencies = new Map<string, number>();
  for (const row of rows) {
    const identities = [
      `email:${key(row.values.email)}`,
      `matricula:${key(row.values.matricula)}`,
      ...(row.values.cpf_ou_identificador
        ? [
            `identificador:${key(normalizeFunctionalIdentifier(row.values.cpf_ou_identificador) || "")}`,
          ]
        : []),
    ];
    for (const identity of identities)
      frequencies.set(identity, (frequencies.get(identity) || 0) + 1);
  }
  const existing = new Set(
    references.existingUsers.flatMap((user) => [
      `email:${key(user.email)}`,
      `matricula:${key(user.registrationNumber)}`,
      ...(user.functionalIdentifier ? [`identificador:${key(user.functionalIdentifier)}`] : []),
    ]),
  );
  return rows.map((row) => {
    const values = row.values;
    const errors = [...row.errors];
    const matchingCategories = references.categories.filter(
      (category) =>
        key(category.name) === key(values.categoria) || category.id === values.categoria,
    );
    const matchingUnits = references.units.filter(
      (unit) =>
        key(unit.code) === key(values.unidade) ||
        key(unit.name) === key(values.unidade) ||
        unit.id === values.unidade,
    );
    const category = matchingCategories.length === 1 ? matchingCategories[0] : undefined;
    const unit = matchingUnits.length === 1 ? matchingUnits[0] : undefined;
    if (!category?.active)
      errors.push(
        "Categoria inexistente, inativa ou ambígua. Utilize o nome de uma categoria ativa.",
      );
    if (!unit?.active)
      errors.push(
        "Unidade inexistente, inativa ou ambígua. Utilize o código de uma unidade ativa.",
      );
    const identifier = normalizeFunctionalIdentifier(values.cpf_ou_identificador);
    if (identifier && /^\d{11}$/.test(identifier) && !isValidCpf(identifier))
      errors.push("CPF estruturalmente inválido. Confira os dígitos verificadores.");
    const input = {
      name: values.nome,
      email: values.email.toLowerCase(),
      registrationNumber: values.matricula.toUpperCase(),
      functionalIdentifier: identifier || null,
      accessProfile: values.perfil.toUpperCase(),
      professionalCategoryId: category?.id || "",
      primaryUnitId: unit?.id || "",
      status: values.status.toUpperCase(),
    };
    const parsed = userInputSchema.safeParse(input);
    if (!parsed.success) {
      const labels: Record<string, string> = {
        name: "nome",
        email: "email",
        registrationNumber: "matrícula",
        functionalIdentifier: "CPF/identificador",
        accessProfile: "perfil",
        status: "status",
        professionalCategoryId: "categoria",
        primaryUnitId: "unidade",
      };
      for (const issue of parsed.error.issues)
        errors.push(`${labels[String(issue.path[0])] || "campo"}: ${issue.message}`);
    }
    const identities = [
      `email:${key(input.email)}`,
      `matricula:${key(input.registrationNumber)}`,
      ...(identifier ? [`identificador:${key(identifier)}`] : []),
    ];
    const duplicateInFile = identities.some((identity) => (frequencies.get(identity) || 0) > 1);
    const duplicateInDatabase = identities.some((identity) => existing.has(identity));
    if (duplicateInFile) errors.push("E-mail, matrícula ou identificador duplicado no arquivo.");
    if (duplicateInDatabase)
      errors.push("E-mail, matrícula ou identificador já cadastrado no banco.");
    return {
      line: row.line,
      values,
      data: parsed.success
        ? { ...parsed.data, functionalIdentifier: parsed.data.functionalIdentifier || undefined }
        : {
            name: input.name,
            email: input.email,
            registrationNumber: input.registrationNumber,
            functionalIdentifier: identifier || undefined,
          },
      errors: [...new Set(errors)],
      duplicate: duplicateInFile || duplicateInDatabase,
    };
  });
}
