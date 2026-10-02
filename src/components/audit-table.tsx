"use client";
import { formatDate } from "@/lib/api-client";
import type { AuditEntry } from "@/lib/contracts";
import { EmptyState } from "./ui";
const labels: Record<string, string> = {
  LOGIN: "Acesso ao sistema",
  LOGIN_FAILED: "Tentativa de acesso recusada",
  USER_IMPORT_CONFIRMED: "Importação de usuários confirmada",
  LOGOUT: "Saída do sistema",
  USER_CREATED: "Usuário criado",
  USER_UPDATED: "Usuário alterado",
  USER_PROFILE_CHANGED: "Perfil alterado",
  USER_CATEGORY_CHANGED: "Categoria alterada",
  USER_UNIT_CHANGED: "Unidade alterada",
  USER_ACTIVATED: "Usuário ativado",
  USER_DEACTIVATED: "Usuário inativado",
  USER_INACTIVATED: "Usuário inativado",
  USERS_IMPORTED: "Usuários importados",
  IMPORT_CONFIRMED: "Importação confirmada",
  PASSWORD_CHANGED: "Senha alterada",
  IMPORT_PREVIEW: "Prévia de importação",
};
export function AuditTable({ entries }: { entries: AuditEntry[] }) {
  if (!entries.length)
    return (
      <EmptyState
        compact
        title="Nenhum registro no histórico"
        description="As ações administrativas serão registradas automaticamente."
      />
    );
  return (
    <div className="table-container">
      <table className="data-table">
        <thead>
          <tr>
            <th>Data e hora</th>
            <th>Ação</th>
            <th>Responsável</th>
            <th>Registro</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id}>
              <td>{formatDate(entry.createdAt, true)}</td>
              <td>{labels[entry.action] || entry.action}</td>
              <td>{entry.actorUser?.name || "Sistema"}</td>
              <td>
                <details>
                  <summary>Ver alterações</summary>
                  <pre className="audit-values">
                    {JSON.stringify(
                      {
                        anterior: entry.previousValue,
                        atual: entry.newValue,
                        contexto: entry.metadata,
                      },
                      null,
                      2,
                    )}
                  </pre>
                </details>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
