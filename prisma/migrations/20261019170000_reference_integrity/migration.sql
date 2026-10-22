-- Preserve logical identity regardless of letter case. Existing duplicates must be
-- resolved before applying; this migration never deletes or merges user data.
CREATE UNIQUE INDEX "Unit_code_ci_key" ON "Unit" (lower(btrim("code")));
CREATE UNIQUE INDEX "ProfessionalCategory_name_ci_key" ON "ProfessionalCategory" (lower(btrim("name")));
