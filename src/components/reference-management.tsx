"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api-client";
import type { AuditEntry, ReferenceItem } from "@/lib/contracts";
import {
  Alert,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  Skeleton,
} from "./ui";
import { AuditTable } from "./audit-table";

type Result = { items: ReferenceItem[]; total: number; page: number; pageSize: number };
type Draft = { name: string; active: boolean; code: string; timezone: string };
const blank: Draft = { name: "", active: true, code: "", timezone: "America/Sao_Paulo" };
export function ReferencePage({ kind }: { kind: "units" | "categories" }) {
  const units = kind === "units";
  const [result, setResult] = useState<Result | null>(null);
  const [filters, setFilters] = useState({ q: "", status: "" });
  const [applied, setApplied] = useState(filters);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<{ id?: string } | null>(null);
  const [draft, setDraft] = useState<Draft>(blank);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [confirm, setConfirm] = useState<ReferenceItem | null>(null);
  const [history, setHistory] = useState<{ title: string; entries: AuditEntry[] } | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const load = useCallback(
    async (q: string, status: string, page: number) => {
      setLoading(true);
      setError("");
      try {
        const query = new URLSearchParams({ page: String(page) });
        if (q) query.set("q", q);
        if (status) query.set("status", status);
        let response = await api<Result>(`/api/references/${kind}?${query}`);
        if (page > 1 && response.items.length === 0) {
          query.set("page", String(Math.max(1, Math.ceil(response.total / response.pageSize))));
          response = await api<Result>(`/api/references/${kind}?${query}`);
        }
        setResult(response);
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        setLoading(false);
      }
    },
    [kind],
  );
  useEffect(() => {
    let live = true;
    api<Result>(`/api/references/${kind}`)
      .then((response) => {
        if (live) setResult(response);
      })
      .catch((err) => {
        if (live) setError(errorMessage(err));
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [kind]);
  function openEditor(item?: ReferenceItem) {
    setFormError("");
    setEditing(item ? { id: item.id } : {});
    setDraft(
      item
        ? {
            name: item.name,
            active: item.active,
            code: item.code ?? "",
            timezone: item.timezone ?? "America/Sao_Paulo",
          }
        : { ...blank },
    );
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    setSaving(true);
    setFormError("");
    try {
      await api(`/api/references/${kind}${editing.id ? `/${editing.id}` : ""}`, {
        method: editing.id ? "PATCH" : "POST",
        body: JSON.stringify(units ? draft : { name: draft.name, active: draft.active }),
      });
      setEditing(null);
      toast.success("Cadastro salvo.");
      await load(applied.q, applied.status, result?.page ?? 1);
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }
  async function changeStatus() {
    if (!confirm) return;
    setSaving(true);
    setError("");
    try {
      await api(`/api/references/${kind}/${confirm.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: confirm.name,
          active: !confirm.active,
          ...(units ? { code: confirm.code, timezone: confirm.timezone } : {}),
        }),
      });
      toast.success(confirm.active ? "Cadastro inativado." : "Cadastro ativado.");
      await load(applied.q, applied.status, result?.page ?? 1);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
      setConfirm(null);
    }
  }
  async function showHistory(item: ReferenceItem) {
    setHistory({ title: item.name, entries: [] });
    setHistoryLoading(true);
    setHistoryError("");
    try {
      const response = await api<{ history: AuditEntry[] }>(`/api/references/${kind}/${item.id}`);
      setHistory((current) =>
        current?.title === item.name ? { ...current, entries: response.history } : current,
      );
    } catch (err) {
      setHistoryError(errorMessage(err));
    } finally {
      setHistoryLoading(false);
    }
  }
  const title = units ? "Unidades" : "Categorias profissionais";
  return (
    <>
      <PageHeader
        eyebrow="Gestão"
        title={title}
        description={
          units
            ? "Gerencie unidades e seus vínculos com a equipe."
            : "Gerencie categorias profissionais, independentes dos três perfis de acesso."
        }
        actions={
          <Button onClick={() => openEditor()}>
            <Plus size={16} />
            {units ? "Nova unidade" : "Nova categoria"}
          </Button>
        }
      />
      <form
        className="filter-bar"
        onSubmit={(event) => {
          event.preventDefault();
          setApplied(filters);
          void load(filters.q, filters.status, 1);
        }}
      >
        <Field label="Pesquisar" id="reference-search">
          <Input
            id="reference-search"
            value={filters.q}
            maxLength={120}
            placeholder={units ? "Nome ou código" : "Nome da categoria"}
            onChange={(e) => setFilters({ ...filters, q: e.target.value })}
          />
        </Field>
        <Field label="Status" id="reference-status">
          <Select
            id="reference-status"
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          >
            <option value="">Todos</option>
            <option value="active">Ativas</option>
            <option value="inactive">Inativas</option>
          </Select>
        </Field>
        <div className="filter-actions">
          <Button type="submit" variant="secondary" disabled={loading}>
            Filtrar
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              const next = { q: "", status: "" };
              setFilters(next);
              setApplied(next);
              void load("", "", 1);
            }}
          >
            Limpar
          </Button>
        </div>
      </form>
      {error && <Alert variant="error">{error}</Alert>}
      {loading ? (
        <Card className="loading-panel" role="status" aria-label="Carregando cadastros">
          <Skeleton />
          <Skeleton />
        </Card>
      ) : (
        <Card>
          {result?.items.length ? (
            <div className="table-container">
              <table className="data-table reference-table">
                <thead>
                  <tr>
                    <th>Nome</th>
                    {units && (
                      <>
                        <th>Código</th>
                        <th>Fuso horário</th>
                      </>
                    )}
                    <th>Vínculos</th>
                    <th>Status</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {result.items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.name}</strong>
                      </td>
                      {units && (
                        <>
                          <td>{item.code}</td>
                          <td>{item.timezone}</td>
                        </>
                      )}
                      <td>{item.linkedUsers ?? 0}</td>
                      <td>
                        <Badge variant={item.active ? "success" : "neutral"}>
                          {item.active ? "Ativa" : "Inativa"}
                        </Badge>
                      </td>
                      <td>
                        <div className="reference-actions">
                          <Button
                            variant="ghost"
                            aria-label={`Editar ${item.name}`}
                            onClick={() => openEditor(item)}
                          >
                            Editar
                          </Button>
                          <Button
                            variant="ghost"
                            aria-label={`Histórico ${item.name}`}
                            onClick={() => void showHistory(item)}
                          >
                            Histórico
                          </Button>
                          <Button
                            variant="ghost"
                            aria-label={`${item.active ? "Inativar" : "Ativar"} ${item.name}`}
                            onClick={() => setConfirm(item)}
                          >
                            {item.active ? "Inativar" : "Ativar"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="Nenhum cadastro encontrado"
              description="Revise os filtros ou adicione um cadastro."
            />
          )}
          <div className="table-footer reference-pagination">
            <span aria-live="polite">
              {result?.total ?? 0} cadastros · Página {result?.page ?? 1}
            </span>
            <div className="reference-actions">
              <Button
                variant="secondary"
                disabled={!result || result.page <= 1}
                onClick={() => void load(applied.q, applied.status, (result?.page ?? 1) - 1)}
              >
                Anterior
              </Button>
              <Button
                variant="secondary"
                disabled={!result || result.page * result.pageSize >= result.total}
                onClick={() => void load(applied.q, applied.status, (result?.page ?? 1) + 1)}
              >
                Próxima
              </Button>
            </div>
          </div>
        </Card>
      )}
      <Modal
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open && !saving) setEditing(null);
        }}
        title={
          editing?.id
            ? units
              ? "Editar unidade"
              : "Editar categoria"
            : units
              ? "Nova unidade"
              : "Nova categoria"
        }
        description="Revise os dados. As alterações ficam registradas no histórico."
      >
        <form onSubmit={save}>
          {formError && <Alert variant="error">{formError}</Alert>}
          <fieldset disabled={saving} className="reference-fields">
            <Field label="Nome" id="reference-name" required>
              <Input
                id="reference-name"
                value={draft.name}
                minLength={2}
                maxLength={120}
                required
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </Field>
            {units && (
              <>
                <Field
                  label="Código"
                  id="reference-code"
                  required
                  hint="Identificador único; letras, números, hífen ou sublinhado."
                >
                  <Input
                    id="reference-code"
                    value={draft.code}
                    required
                    maxLength={30}
                    pattern={"[a-zA-Z0-9_\\-]+"}
                    onChange={(e) => setDraft({ ...draft, code: e.target.value })}
                  />
                </Field>
                <Field label="Fuso horário" id="reference-timezone" required>
                  <Input
                    id="reference-timezone"
                    value={draft.timezone}
                    required
                    maxLength={80}
                    onChange={(e) => setDraft({ ...draft, timezone: e.target.value })}
                  />
                </Field>
              </>
            )}
          </fieldset>
          <div className="dialog-actions">
            <Button
              type="button"
              variant="secondary"
              disabled={saving}
              onClick={() => setEditing(null)}
            >
              Cancelar
            </Button>
            <Button type="submit" loading={saving}>
              {saving ? "Salvando..." : "Salvar cadastro"}
            </Button>
          </div>
        </form>
      </Modal>
      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
        title={confirm?.active ? "Inativar cadastro?" : "Ativar cadastro?"}
        description={
          confirm?.active
            ? "Usuários ativos precisam ser transferidos ou inativados antes. Os vínculos históricos serão preservados."
            : "O cadastro voltará a estar disponível para novos vínculos."
        }
        confirmLabel={confirm?.active ? "Inativar" : "Ativar"}
        danger={confirm?.active}
        loading={saving}
        onConfirm={() => void changeStatus()}
      />
      <Modal
        open={history !== null}
        onOpenChange={(open) => {
          if (!open) setHistory(null);
        }}
        title={`Histórico: ${history?.title ?? ""}`}
        description="Ações administrativas registradas para este cadastro."
      >
        {historyError ? (
          <Alert variant="error">{historyError}</Alert>
        ) : historyLoading ? (
          <Skeleton />
        ) : (
          <AuditTable entries={history?.entries ?? []} />
        )}
      </Modal>
    </>
  );
}
