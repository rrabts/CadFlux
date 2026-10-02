"use client";
import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api-client";
import {
  profileLabels,
  statusLabels,
  type SafeUser,
  type ReferenceItem,
  type UserInput,
} from "@/lib/contracts";
import {
  Button,
  Input,
  Select,
  Field,
  PageHeader,
  Card,
  Badge,
  Alert,
  EmptyState,
  Modal,
  Tabs,
  ConfirmDialog,
} from "@/components/ui";
import { AuditTable } from "@/modules/audit/audit-table";
type Refs = { units: ReferenceItem[]; categories: ReferenceItem[] };
const empty: UserInput = {
  name: "",
  email: "",
  registrationNumber: "",
  functionalIdentifier: "",
  accessProfile: "INTERVIEWER",
  professionalCategoryId: "",
  primaryUnitId: "",
  status: "ACTIVE",
};
export function UserManager({ actorId }: { actorId: string }) {
  const [rows, setRows] = useState<SafeUser[]>([]),
    [refs, setRefs] = useState<Refs>({ units: [], categories: [] }),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [editing, setEditing] = useState<SafeUser | null | undefined>(undefined),
    [data, setData] = useState<UserInput>(empty),
    [secret, setSecret] = useState(""),
    [toggle, setToggle] = useState<SafeUser | null>(null),
    [query, setQuery] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [users, references] = await Promise.all([
        api<SafeUser[]>(`/api/users${query ? "?" + query : ""}`),
        api<Refs>("/api/references"),
      ]);
      setRows(users);
      setRefs(references);
      setError("");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [query]);
  useEffect(() => {
    let active = true;
    Promise.all([
      api<SafeUser[]>(`/api/users${query ? "?" + query : ""}`),
      api<Refs>("/api/references"),
    ])
      .then(([users, references]) => {
        if (active) {
          setRows(users);
          setRefs(references);
        }
      })
      .catch((e) => {
        if (active) setError(errorMessage(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [query]);
  function open(user: SafeUser | null) {
    setEditing(user);
    setSecret("");
    setError("");
    setData(
      user
        ? {
            name: user.name,
            email: user.email,
            registrationNumber: user.registrationNumber,
            functionalIdentifier: user.functionalIdentifier,
            accessProfile: user.accessProfile,
            professionalCategoryId: user.professionalCategoryId,
            primaryUnitId: user.primaryUnitId,
            status: user.status,
          }
        : {
            ...empty,
            professionalCategoryId: refs.categories.find((c) => c.active)?.id ?? "",
            primaryUnitId: refs.units.find((u) => u.active)?.id ?? "",
          },
    );
  }
  const patch = (key: keyof UserInput, value: string) =>
    setData((prev) => ({ ...prev, [key]: value }));
  const field = (key: keyof UserInput, label: string, type = "text") => (
    <Field label={label} id={key} key={key}>
      <Input
        id={key}
        name={key}
        type={type}
        value={data[key] ?? ""}
        onChange={(e) => patch(key, e.target.value)}
        required={key !== "functionalIdentifier"}
        maxLength={key === "email" ? 254 : 120}
      />
    </Field>
  );
  async function save() {
    setBusy(true);
    setError("");
    try {
      if (editing) {
        await api(`/api/users/${editing.id}`, { method: "PATCH", body: JSON.stringify(data) });
        setEditing(undefined);
      } else {
        const result = await api<{ temporaryPassword: string }>("/api/users", {
          method: "POST",
          body: JSON.stringify(data),
        });
        setSecret(result.temporaryPassword);
      }
      toast.success("Salvo");
      await load();
    } catch (e) {
      setError(errorMessage(e));
      toast.error("Falha ao salvar.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="GESTÃO"
        title="Gestão de usuários"
        description="Pessoas, vínculos e permissões de acesso."
        actions={
          <>
            <Link className="button button-secondary" href="/users/import">
              Importar usuários
            </Link>
            <Button onClick={() => open(null)}>+ Novo usuário</Button>
          </>
        }
      />
      <Card>
        <form
          className="filter-bar"
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            const search = new URLSearchParams();
            form.forEach((v, k) => {
              if (v) search.set(k, String(v));
            });
            if (query !== search.toString()) {
              setLoading(true);
              setQuery(search.toString());
            } else {
              void load();
            }
          }}
        >
          <Field label="Buscar" id="q">
            <Input id="q" name="q" placeholder="Nome, CPF/identificador ou matrícula" />
          </Field>
          <Field label="Perfil" id="profile">
            <Select id="profile" name="profile">
              <option value="">Todos</option>
              {Object.entries(profileLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Categoria" id="categoryId">
            <Select id="categoryId" name="categoryId">
              <option value="">Todas</option>
              {refs.categories.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Unidade" id="unitId">
            <Select id="unitId" name="unitId">
              <option value="">Todas</option>
              {refs.units.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status" id="filter-status">
            <Select id="filter-status" name="status">
              <option value="">Todos</option>
              <option value="ACTIVE">Ativo</option>
              <option value="INACTIVE">Inativo</option>
            </Select>
          </Field>
          <Button variant="secondary">Buscar</Button>
        </form>
      </Card>
      {error && editing === undefined && <Alert variant="error">{error}</Alert>}
      <Card>
        {loading ? (
          <p role="status">Carregando usuários...</p>
        ) : rows.length ? (
          <div className="table-wrap">
            <table>
              <caption>
                Até 200 resultados · refine os filtros para localizar outros usuários
              </caption>
              <thead>
                <tr>
                  {["Nome", "Matrícula", "Perfil", "Categoria", "Unidade", "Status", "Ações"].map(
                    (h) => (
                      <th key={h}>{h}</th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <strong>{user.name}</strong>
                    </td>
                    <td>{user.registrationNumber}</td>
                    <td>{profileLabels[user.accessProfile]}</td>
                    <td>{user.professionalCategory.name}</td>
                    <td>{user.primaryUnit.name}</td>
                    <td>
                      <Badge variant={user.status === "ACTIVE" ? "success" : "neutral"}>
                        {statusLabels[user.status]}
                      </Badge>
                    </td>
                    <td>
                      <div className="row-actions">
                        <Button variant="ghost" onClick={() => open(user)}>
                          Detalhes
                        </Button>
                        {user.id !== actorId && (
                          <Button variant="ghost" onClick={() => setToggle(user)}>
                            {user.status === "ACTIVE" ? "Inativar" : "Ativar"}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="Nenhum usuário encontrado"
            description="Revise a busca ou cadastre um novo usuário."
          />
        )}
      </Card>
      <Modal
        open={editing !== undefined}
        onOpenChange={(open) => {
          if (!open && !busy) setEditing(undefined);
        }}
        title={editing ? editing.name : "Novo usuário"}
        description={
          editing
            ? `Matrícula ${editing.registrationNumber} · ${statusLabels[editing.status]}`
            : "Informe os dados e vínculos. A senha temporária será gerada automaticamente."
        }
      >
        {secret ? (
          <Alert variant="success">
            Usuário criado. Entregue esta senha por canal seguro; ela é exibida somente agora:{" "}
            <code className="secret">{secret}</code> A troca será obrigatória no primeiro acesso.
          </Alert>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <Tabs
              items={[
                {
                  value: "personal",
                  label: "Dados pessoais",
                  content: (
                    <>
                      {field("name", "Nome")}
                      {field("email", "E-mail", "email")}
                      {field("registrationNumber", "Matrícula")}
                      {field("functionalIdentifier", "CPF ou identificador (opcional)")}
                    </>
                  ),
                },
                {
                  value: "access",
                  label: "Acesso e perfil",
                  content: (
                    <>
                      <Field label="Perfil de acesso" id="accessProfile">
                        <Select
                          id="accessProfile"
                          value={data.accessProfile}
                          disabled={editing?.id === actorId}
                          onChange={(e) => patch("accessProfile", e.target.value)}
                        >
                          {Object.entries(profileLabels).map(([v, l]) => (
                            <option value={v} key={v}>
                              {l}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <Field label="Categoria profissional" id="professionalCategoryId">
                        <Select
                          id="professionalCategoryId"
                          value={data.professionalCategoryId}
                          onChange={(e) => patch("professionalCategoryId", e.target.value)}
                        >
                          {refs.categories.map((c) => (
                            <option disabled={!c.active} value={c.id} key={c.id}>
                              {c.name}
                              {!c.active ? " (inativa)" : ""}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <Field label="Status" id="status">
                        <Select
                          id="status"
                          value={data.status}
                          disabled={editing?.id === actorId}
                          onChange={(e) => patch("status", e.target.value)}
                        >
                          <option value="ACTIVE">Ativo</option>
                          <option value="INACTIVE">Inativo</option>
                        </Select>
                      </Field>
                    </>
                  ),
                },
                {
                  value: "unit",
                  label: "Unidade",
                  content: (
                    <Field label="Unidade principal" id="primaryUnitId">
                      <Select
                        id="primaryUnitId"
                        value={data.primaryUnitId}
                        onChange={(e) => patch("primaryUnitId", e.target.value)}
                      >
                        {refs.units.map((u) => (
                          <option value={u.id} disabled={!u.active} key={u.id}>
                            {u.name}
                            {!u.active ? " (inativa)" : ""}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  ),
                },
                {
                  value: "history",
                  label: "Histórico",
                  content: editing ? (
                    <AuditTable userId={editing.id} />
                  ) : (
                    <p>O histórico começa após o cadastro.</p>
                  ),
                },
              ]}
            />
            {error && <Alert variant="error">{error}</Alert>}
            <div className="dialog-actions">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setEditing(undefined)}
                disabled={busy}
              >
                Cancelar
              </Button>
              <Button loading={busy}>{busy ? "Salvando..." : "Salvar"}</Button>
            </div>
          </form>
        )}
      </Modal>
      <ConfirmDialog
        open={!!toggle}
        onOpenChange={(open) => {
          if (!open) setToggle(null);
        }}
        title={toggle?.status === "ACTIVE" ? "Inativar usuário?" : "Ativar usuário?"}
        description="A alteração será registrada no histórico. A inativação encerra o acesso imediatamente."
        confirmLabel="Confirmar"
        loading={busy}
        onConfirm={async () => {
          if (!toggle) return;
          setBusy(true);
          try {
            await api(`/api/users/${toggle.id}`, {
              method: "PATCH",
              body: JSON.stringify({
                name: toggle.name,
                email: toggle.email,
                registrationNumber: toggle.registrationNumber,
                functionalIdentifier: toggle.functionalIdentifier,
                accessProfile: toggle.accessProfile,
                professionalCategoryId: toggle.professionalCategoryId,
                primaryUnitId: toggle.primaryUnitId,
                status: toggle.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
              }),
            });
            setToggle(null);
            toast.success("Salvo");
            await load();
          } catch (e) {
            setError(errorMessage(e));
            toast.error("Falha ao salvar.");
          } finally {
            setBusy(false);
          }
        }}
      />
    </>
  );
}
