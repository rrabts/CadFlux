"use client";
import { useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api-client";
import type { AuditEntry, ReferenceItem } from "@/lib/contracts";
import { Alert, Badge, Card, EmptyState, PageHeader, Skeleton } from "./ui";
import { AuditTable } from "./audit-table";
type References = { units: (ReferenceItem & { timezone?: string })[]; categories: ReferenceItem[] };
export function ReferencePage({ kind }: { kind: "units" | "categories" }) {
  const [refs, setRefs] = useState<References | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    api<References>("/api/references")
      .then((result) => {
        if (live) setRefs(result);
      })
      .catch((err) => {
        if (live) setError(errorMessage(err));
      });
    return () => {
      live = false;
    };
  }, []);
  const title = kind === "units" ? "Unidades" : "Categorias profissionais";
  return (
    <>
      <PageHeader
        eyebrow="Gestão"
        title={title}
        description={
          kind === "units"
            ? "Unidades disponíveis para vincular a equipe."
            : "Categorias profissionais independentes do perfil de acesso."
        }
      />
      <div className="phase-note">
        <Badge variant="info">Consulta</Badge>
        <p>A manutenção destes cadastros será refinada na próxima fase.</p>
      </div>
      {error ? (
        <Alert variant="error">{error}</Alert>
      ) : !refs ? (
        <Card className="loading-panel" role="status" aria-label="Carregando cadastros">
          <Skeleton />
          <Skeleton />
        </Card>
      ) : (
        <Card>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  {kind === "units" && (
                    <>
                      <th>Código</th>
                      <th>Fuso horário</th>
                    </>
                  )}
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {(kind === "units" ? refs.units : refs.categories).map((item) => (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    {kind === "units" && (
                      <>
                        <td>{item.code}</td>
                        <td>
                          {(item as ReferenceItem & { timezone?: string }).timezone ||
                            "America/Sao_Paulo"}
                        </td>
                      </>
                    )}
                    <td>
                      <Badge variant={item.active ? "success" : "neutral"}>
                        {item.active ? "Ativa" : "Inativa"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
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
