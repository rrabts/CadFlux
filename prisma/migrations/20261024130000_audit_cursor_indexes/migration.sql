-- Support bounded keyset pages, including events sharing the same timestamp.
CREATE INDEX "AuditLog_createdAt_id_idx" ON "AuditLog" ("createdAt", "id");
CREATE INDEX "AuditLog_entityType_entityId_createdAt_id_idx" ON "AuditLog" ("entityType", "entityId", "createdAt", "id");
DROP INDEX "AuditLog_entityType_entityId_createdAt_idx";
