"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api-client";
import type { AuditEntry } from "@/lib/contracts";
import { permitsOpinion, type AttendanceKind } from "@/modules/attendances/contracts";
import { Alert, Button, Card, Field, Input, Modal, PageHeader, Skeleton } from "./ui";
import { AuditTable } from "./audit-table";
type Item = { id?: string; code?: AttendanceKind; name: string; active: boolean; version: number };
type Data = { items: Item[]; total: number; page: number; pageSize: number };
export function CatalogPage({ kind }: { kind: "benefits" | "types" }) {
  const [data, setData] = useState<Data | null>(null),
    [page, setPage] = useState(1),
    [q, setQ] = useState(""),
    [search, setSearch] = useState(""),
    [reload, setReload] = useState(0);
  const [edit, setEdit] = useState<Item | null>(null),
    [history, setHistory] = useState<AuditEntry[] | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [loaded, setLoaded] = useState("");
  const key = `${kind}?page=${page}&q=${encodeURIComponent(q)}`;
  const requestKey = key + "@" + reload;
  useEffect(() => {
    let live = true;
    api<Data>("/api/catalog/" + key)
      .then((d) => {
        if (live) {
          setData(d);
          setError("");
        }
      })
      .catch((e) => {
        if (live) {
          setData(null);
          setError(errorMessage(e));
        }
      })
      .finally(() => {
        if (live) setLoaded(requestKey);
      });
    return () => {
      live = false;
    };
  }, [key, requestKey]);
  async function save() {
    if (!edit) return;
    setBusy(true);
    setError("");
    try {
      const id = edit.id ?? edit.code;
      await api("/api/catalog/" + kind + (id ? "/" + id : ""), {
        method: id ? "PATCH" : "POST",
        body: JSON.stringify({
          name: edit.name,
          active: edit.active,
          ...(id ? { version: edit.version } : {}),
        }),
      });
      setEdit(null);
      setReload((n) => n + 1);
      toast.success("Cadastro salvo com histórico.");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function showHistory(item: Item) {
    try {
      const d = await api<{ history: AuditEntry[] }>(
        `/api/catalog/${kind}/${item.id ?? item.code}`,
      );
      setHistory(d.history);
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="Gestão"
        title={kind === "benefits" ? "Benefícios" : "Tipos de atendimento"}
        description={
          kind === "benefits"
            ? "Benefícios informados no atendimento. O registro não comprova concessão ou elegibilidade."
            : "Os sete códigos e suas regras permanecem fixos. Alterações de nome não reescrevem registros anteriores."
        }
        actions={
          kind === "benefits" && (
            <Button
              onClick={() => {
                setError("");
                setEdit({ name: "", active: true, version: 1 });
              }}
            >
              Novo benefício
            </Button>
          )
        }
      />
      <form
        className="filter-bar"
        onSubmit={(e) => {
          e.preventDefault();
          setQ(search);
          setPage(1);
          setReload((n) => n + 1);
        }}
      >
        <Field label="Pesquisar nome" id="catalog-search">
          <Input id="catalog-search" value={search} onChange={(e) => setSearch(e.target.value)} />
        </Field>
        <Button type="submit">Pesquisar</Button>
      </form>
      {error && !edit && <Alert variant="error">{error}</Alert>}
      <Card>
        {loaded !== requestKey ? (
          <Skeleton />
        ) : (
          <>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Situação</th>
                    {kind === "types" && <th>Regra preservada</th>}
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.items.map((item) => (
                    <tr key={item.id ?? item.code}>
                      <td>{item.name}</td>
                      <td>{item.active ? "Ativo" : "Inativo"}</td>
                      {item.code && (
                        <td>
                          {item.code === "GUIDANCE"
                            ? "Sem código familiar e sem parecer"
                            : permitsOpinion(item.code)
                              ? "Código familiar obrigatório; admite parecer"
                              : "Código familiar obrigatório; sem parecer"}
                        </td>
                      )}
                      <td>
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setError("");
                            setEdit(item);
                          }}
                        >
                          Editar {item.name}
                        </Button>
                        <Button variant="ghost" onClick={() => void showHistory(item)}>
                          Histórico de {item.name}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="table-footer reference-pagination">
              <span>
                {data?.total ?? 0} cadastro(s) · Página {page}
              </span>
              <Button
                variant="secondary"
                disabled={page === 1}
                onClick={() => setPage((n) => n - 1)}
              >
                Anterior
              </Button>
              <Button
                variant="secondary"
                disabled={page * 50 >= (data?.total ?? 0)}
                onClick={() => setPage((n) => n + 1)}
              >
                Próxima
              </Button>
            </div>
          </>
        )}
      </Card>
      <Modal
        open={Boolean(edit)}
        onOpenChange={(open) => {
          if (!busy && !open) setEdit(null);
        }}
        title={kind === "benefits" ? "Editar benefício" : "Editar tipo"}
      >
        {edit && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            {error && <Alert variant="error">{error}</Alert>}
            <Field label="Nome" id="catalog-name" required>
              <Input
                id="catalog-name"
                required
                minLength={2}
                maxLength={120}
                value={edit.name}
                onChange={(e) => setEdit({ ...edit, name: e.target.value })}
              />
            </Field>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={edit.active}
                onChange={(e) => setEdit({ ...edit, active: e.target.checked })}
              />
              Ativo para novos registros
            </label>
            <div className="dialog-actions">
              <Button type="submit" loading={busy}>
                Salvar
              </Button>
            </div>
          </form>
        )}
      </Modal>
      <Modal
        open={history !== null}
        onOpenChange={(open) => {
          if (!open) setHistory(null);
        }}
        title="Histórico do cadastro"
      >
        <AuditTable entries={history ?? []} />
      </Modal>
    </>
  );
}
