"use client";
import { useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api-client";
import type { AuditEntry } from "@/lib/contracts";
import { Alert, Card, EmptyState, PageHeader, Skeleton } from "./ui";
import { AuditTable } from "./audit-table";
export { ReferencePage } from "./reference-management";
export function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    api<{ entries: AuditEntry[] }>("/api/audit")
      .then((result) => {
        if (live) setEntries(result.entries);
      })
      .catch((err) => {
        if (live) setError(errorMessage(err));
      });
    return () => {
      live = false;
    };
  }, []);
  return (
    <>
      <PageHeader
        eyebrow="Administração"
        title="Auditoria"
        description="Registro das ações de acesso e gestão. Os registros são preservados sem edição ou exclusão."
      />
      {error ? (
        <Alert variant="error">{error}</Alert>
      ) : entries ? (
        <Card>
          <AuditTable entries={entries} />
        </Card>
      ) : (
        <Card className="loading-panel" role="status" aria-label="Carregando auditoria">
          <Skeleton />
          <Skeleton />
        </Card>
      )}
      {entries?.length === 0 && (
        <EmptyState
          title="Aguardando ações"
          description="Os próximos acessos e alterações serão registrados aqui."
        />
      )}
    </>
  );
}
