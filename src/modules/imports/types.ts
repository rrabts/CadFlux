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
export const MAX_IMPORT_ROWS = 1000;
export const IMPORT_PREVIEW_TTL_MS = 30 * 60 * 1000;

export type ImportColumn = (typeof IMPORT_COLUMNS)[number];
export type ImportRawData = Record<ImportColumn, string>;

export type ParsedImportRow = {
  line: number;
  values: ImportRawData;
  errors: string[];
};

export type ImportUserData = {
  name: string;
  functionalIdentifier?: string;
  email: string;
  registrationNumber: string;
  accessProfile: "INTERVIEWER" | "REFERRAL_OPERATOR" | "DIRECTION";
  professionalCategoryId: string;
  primaryUnitId: string;
  status: "ACTIVE" | "INACTIVE";
};

export type ImportPreviewRow = {
  line: number;
  data: Partial<ImportUserData>;
  errors: string[];
  duplicate: boolean;
};

export type ImportReferences = {
  categories: { id: string; name: string; active: boolean }[];
  units: { id: string; name: string; code: string; active: boolean }[];
  existingUsers: {
    email: string;
    registrationNumber: string;
    functionalIdentifier: string | null;
  }[];
};
