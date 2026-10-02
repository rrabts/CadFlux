export const IMPORT_COLUMNS = [
  "nome",
  "cpf_ou_identificador",
  "email",
  "matricula",
  "perfil",
  "categoria",
  "unidade",
  "status",
] as const;
export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 500;
export const IMPORT_PREVIEW_TTL_MS = 30 * 60 * 1000;
