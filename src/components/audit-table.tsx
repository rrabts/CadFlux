"use client";
import { useState } from "react";
import { api, errorMessage, formatDate } from "@/lib/api-client";
import type { AuditEntry } from "@/lib/contracts";
import { Alert, Button, EmptyState } from "./ui";
const labels: Record<string, string> = {
  CATALOG_CREATED: "Cadastro operacional criado",
  CATALOG_UPDATED: "Cadastro operacional alterado",
  OPERATIONAL_UNIT_CHANGED: "Local de atendimento alterado",
  ATTENDANCE_CREATED: "Atendimento registrado",
  ATTENDANCE_UPDATED: "Atendimento alterado",
  ATTENDANCE_CANCELLED: "Atendimento cancelado",
  UNIT_CREATED: "Unidade criada",
  UNIT_UPDATED: "Unidade alterada",
  UNIT_ACTIVATED: "Unidade ativada",
  UNIT_INACTIVATED: "Unidade inativada",
  CATEGORY_CREATED: "Categoria criada",
  CATEGORY_UPDATED: "Categoria alterada",
  CATEGORY_ACTIVATED: "Categoria ativada",
  CATEGORY_INACTIVATED: "Categoria inativada",
  USER_ADDITIONAL_UNITS_CHANGED: "Unidades adicionais alteradas",
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
type AuditTableProps = { entries: AuditEntry[]; endpoint?: string; nextCursor?: string | null };
export function AuditTable(props: AuditTableProps) {
  // A fresh query/history resets previously appended pages; old responses belong to the unmounted instance.
  const key = `${props.endpoint}:${props.entries[0]?.id}:${props.entries.at(-1)?.id}:${props.entries.length}:${props.nextCursor}`;
  return <AuditPages key={key} {...props} />;
}
function AuditPages({ entries, endpoint, nextCursor = null }: AuditTableProps) {
  const [rows, setRows] = useState(entries);
  const [cursor, setCursor] = useState(nextCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function more() {
    if (!cursor || !endpoint || loading) return;
    setLoading(true);
    setError("");
    try {
      const page = await api<{
        entries?: AuditEntry[];
        history?: AuditEntry[];
        nextHistoryCursor: string | null;
      }>(`${endpoint}${endpoint.includes("?") ? "&" : "?"}cursor=${encodeURIComponent(cursor)}`);
      setRows((previous) => {
        const existing = new Set(previous.map((entry) => entry.id));
        return [
          ...previous,
          ...(page.entries ?? page.history ?? []).filter((entry) => !existing.has(entry.id)),
        ];
      });
      setCursor(page.nextHistoryCursor);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }
  if (!rows.length)
    return (
      <EmptyState
        compact
        title="Nenhum registro no histórico"
        description="As ações administrativas serão registradas automaticamente."
      />
    );
  return (
    <>
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
            {rows.map((entry) => (
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
      {error && <Alert variant="error">{error}</Alert>}
      {endpoint && (
        <div className="table-footer">
          <span aria-live="polite">
            {rows.length} registros carregados
            {cursor ? "; há registros anteriores." : "; histórico completo."}
          </span>
          {cursor && (
            <Button type="button" variant="secondary" loading={loading} onClick={() => void more()}>
              Carregar registros anteriores
            </Button>
          )}
        </div>
      )}
    </>
  );
}
