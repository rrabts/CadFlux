"use client";
import { useEffect, useState } from "react";
import { api, errorMessage, formatDate } from "@/lib/api-client";
import { Alert, EmptyState } from "@/components/ui";
import type { AuditEntry } from "@/lib/contracts";
export function AuditTable({ userId }: { userId?: string }) {
  const [rows, setRows] = useState<AuditEntry[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(true);
  useEffect(() => {
    let active = true;
    api<AuditEntry[]>(userId ? `/api/users/${userId}/history` : "/api/audit")
      .then((data) => {
        if (active) setRows(data);
      })
      .catch((e) => {
        if (active) setError(errorMessage(e));
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [userId]);
  if (error) return <Alert variant="error">{error}</Alert>;
  if (busy) return <p role="status">Carregando histórico...</p>;
  return rows.length ? (
    <div className="table-wrap">
      <table>
        <caption className="sr-only">Histórico de auditoria, registros mais recentes</caption>
        <thead>
          <tr>
            <th>Data</th>
            <th>Ação</th>
            <th>Entidade</th>
            <th>Alteração</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{formatDate(row.createdAt, true)}</td>
              <td>{row.action}</td>
              <td>{row.entityType}</td>
              <td>
                <details>
                  <summary>Consultar</summary>
                  <pre>
                    {JSON.stringify({ antes: row.previousValue, depois: row.newValue }, null, 2)}
                  </pre>
                </details>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <EmptyState title="Sem histórico" description="As alterações relevantes aparecerão aqui." />
  );
}
