"use client";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Copy, Plus, Search, Upload } from "lucide-react";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api-client";
import {
  profileLabels,
  statusLabels,
  type AccessProfile,
  type AuditEntry,
  type ReferenceItem,
  type SafeUser,
  type UserInput,
  type UserStatus,
} from "@/lib/contracts";
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
  Tabs,
} from "./ui";
import { AuditTable } from "./audit-table";

type UserListResult = { users: SafeUser[]; total: number; page: number; pageSize: number };
type References = { units: ReferenceItem[]; categories: ReferenceItem[] };
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
function toInput(user: SafeUser): UserInput {
  return {
    name: user.name,
    email: user.email,
    registrationNumber: user.registrationNumber,
    functionalIdentifier: user.functionalIdentifier,
    accessProfile: user.accessProfile,
    professionalCategoryId: user.professionalCategoryId,
    primaryUnitId: user.primaryUnitId,
    status: user.status,
  };
}
function Loading() {
  return (
    <Card className="loading-panel" role="status" aria-label="Carregando usuários">
      <Skeleton />
      <Skeleton />
      <Skeleton />
    </Card>
  );
}
export function UserList() {
  const [users, setUsers] = useState<SafeUser[]>([]);
  const [refs, setRefs] = useState<References>({ units: [], categories: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({
    q: "",
    profile: "",
    categoryId: "",
    unitId: "",
    status: "",
  });
  const [appliedFilters, setAppliedFilters] = useState(filters);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pageSize: 50 });
  async function load(next = filters, nextPage = 1) {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({ page: String(nextPage) });
      Object.entries(next).forEach(([key, value]) => {
        if (value) query.set(key, value);
      });
      const result = await api<UserListResult>("/api/users?" + query.toString());
      setUsers(result.users);
      setPagination({ total: result.total, page: result.page, pageSize: result.pageSize });
      setAppliedFilters(next);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    let live = true;
    Promise.all([api<UserListResult>("/api/users"), api<References>("/api/references")])
      .then(([result, references]) => {
        if (live) {
          setUsers(result.users);
          setPagination({ total: result.total, page: result.page, pageSize: result.pageSize });
          setRefs(references);
        }
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
  }, []);
  function search(event: FormEvent) {
    event.preventDefault();
    void load();
  }
  return (
    <>
      <PageHeader
        eyebrow="Gestão"
        title="Gestão de usuários"
        description="Gerencie os acessos e vínculos da equipe."
        actions={
          <>
            <Link className="button button-secondary" href="/users/import">
              <Upload size={16} />
              Importar usuários
            </Link>
            <Link className="button button-primary" href="/users/new">
              <Plus size={17} />
              Novo usuário
            </Link>
          </>
        }
      />
      <form className="filter-bar" onSubmit={search}>
        <Field label="Pesquisar" id="user-search">
          <Input
            id="user-search"
            value={filters.q}
            onChange={(e) => setFilters({ ...filters, q: e.target.value })}
            placeholder="Nome, e-mail, matrícula ou identificador"
          />
        </Field>
        <Field label="Perfil" id="filter-profile">
          <Select
            id="filter-profile"
            value={filters.profile}
            onChange={(e) => setFilters({ ...filters, profile: e.target.value })}
          >
            <option value="">Todos</option>
            {Object.entries(profileLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Categoria" id="filter-category">
          <Select
            id="filter-category"
            value={filters.categoryId}
            onChange={(e) => setFilters({ ...filters, categoryId: e.target.value })}
          >
            <option value="">Todas</option>
            {refs.categories.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Unidade" id="filter-unit">
          <Select
            id="filter-unit"
            value={filters.unitId}
            onChange={(e) => setFilters({ ...filters, unitId: e.target.value })}
          >
            <option value="">Todas</option>
            {refs.units.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Status" id="filter-status">
          <Select
            id="filter-status"
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          >
            <option value="">Todos</option>
            <option value="ACTIVE">Ativo</option>
            <option value="INACTIVE">Inativo</option>
          </Select>
        </Field>
        <div className="filter-actions">
          <Button variant="secondary" loading={loading} type="submit">
            <Search size={15} />
            Filtrar
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              const next = { q: "", profile: "", categoryId: "", unitId: "", status: "" };
              setFilters(next);
              void load(next);
            }}
          >
            Limpar
          </Button>
        </div>
      </form>
      {error && (
        <div className="inline-error">
          <Alert variant="error">{error}</Alert>
        </div>
      )}
      {loading ? (
        <Loading />
      ) : (
        <Card>
          {users.length ? (
            <>
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Nome</th>
                      <th>Matrícula</th>
                      <th>Perfil</th>
                      <th>Categoria</th>
                      <th>Unidade</th>
                      <th>Status</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id}>
                        <td className="user-cell">
                          <Link href={"/users/" + user.id}>
                            <strong>{user.name}</strong>
                            <small>{user.email}</small>
                          </Link>
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
                          <Link className="text-link" href={"/users/" + user.id}>
                            Detalhes / editar
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <EmptyState
              title="Nenhum usuário encontrado"
              description="Revise os filtros ou crie um novo usuário."
            />
          )}
          <div
            className="table-footer"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <span aria-live="polite">
              Mostrando {users.length ? (pagination.page - 1) * pagination.pageSize + 1 : 0}–
              {users.length ? (pagination.page - 1) * pagination.pageSize + users.length : 0} de{" "}
              {pagination.total} usuários
            </span>
            <nav
              aria-label="Paginação de usuários"
              style={{ display: "flex", alignItems: "center", gap: 8 }}
            >
              <Button
                variant="secondary"
                disabled={loading || pagination.page <= 1}
                onClick={() => void load(appliedFilters, pagination.page - 1)}
              >
                Anterior
              </Button>
              <span>
                Página {pagination.page} de{" "}
                {Math.max(1, Math.ceil(pagination.total / pagination.pageSize))}
              </span>
              <Button
                variant="secondary"
                disabled={loading || pagination.page * pagination.pageSize >= pagination.total}
                onClick={() => void load(appliedFilters, pagination.page + 1)}
              >
                Próxima
              </Button>
            </nav>
          </div>
        </Card>
      )}
    </>
  );
}
export function UserEditor({ userId, viewerId }: { userId?: string; viewerId: string }) {
  const router = useRouter();
  const [data, setData] = useState<UserInput>(empty);
  const [user, setUser] = useState<SafeUser | null>(null);
  const [history, setHistory] = useState<AuditEntry[]>([]);
  const [refs, setRefs] = useState<References>({ units: [], categories: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [credential, setCredential] = useState<{
    name: string;
    email: string;
    temporaryPassword: string;
  } | null>(null);
  useEffect(() => {
    let live = true;
    async function init() {
      try {
        const references = await api<References>("/api/references");
        if (!live) return;
        setRefs(references);
        if (userId) {
          const result = await api<{ user: SafeUser; history: AuditEntry[] }>(
            "/api/users/" + userId,
          );
          if (!live) return;
          setUser(result.user);
          setData(toInput(result.user));
          setHistory(result.history);
        } else {
          setData({
            ...empty,
            professionalCategoryId: references.categories.find((item) => item.active)?.id || "",
            primaryUnitId: references.units.find((item) => item.active)?.id || "",
          });
        }
      } catch (err) {
        if (live) setError(errorMessage(err));
      } finally {
        if (live) setLoading(false);
      }
    }
    void init();
    return () => {
      live = false;
    };
  }, [userId]);
  function update<K extends keyof UserInput>(key: K, value: UserInput[K]) {
    setData((previous) => ({ ...previous, [key]: value }));
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (userId) {
        const result = await api<{ user: SafeUser }>("/api/users/" + userId, {
          method: "PATCH",
          body: JSON.stringify(data),
        });
        setUser(result.user);
        setData(toInput(result.user));
        const detail = await api<{ history: AuditEntry[] }>("/api/users/" + userId);
        setHistory(detail.history);
        toast.success("Usuário atualizado.");
        router.refresh();
      } else {
        const result = await api<{ user: SafeUser; temporaryPassword: string }>("/api/users", {
          method: "POST",
          body: JSON.stringify(data),
        });
        setUser(result.user);
        setCredential({
          name: result.user.name,
          email: result.user.email,
          temporaryPassword: result.temporaryPassword,
        });
        toast.success("Usuário criado.");
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }
  async function changeStatus() {
    if (!user) return;
    setSaving(true);
    setError("");
    try {
      const next = {
        ...toInput(user),
        status: (user.status === "ACTIVE" ? "INACTIVE" : "ACTIVE") as UserStatus,
      };
      const result = await api<{ user: SafeUser }>("/api/users/" + user.id, {
        method: "PATCH",
        body: JSON.stringify(next),
      });
      setUser(result.user);
      setData(toInput(result.user));
      const detail = await api<{ history: AuditEntry[] }>("/api/users/" + user.id);
      setHistory(detail.history);
      setConfirm(false);
      toast.success(result.user.status === "ACTIVE" ? "Usuário ativado." : "Usuário inativado.");
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
      setConfirm(false);
    } finally {
      setSaving(false);
    }
  }
  const personal = (
    <div className="form-grid">
      <Field label="Nome completo" id="name" required>
        <Input
          id="name"
          value={data.name}
          onChange={(e) => update("name", e.target.value)}
          required
          maxLength={120}
        />
      </Field>
      <Field label="E-mail" id="user-email" required>
        <Input
          id="user-email"
          type="email"
          value={data.email}
          onChange={(e) => update("email", e.target.value)}
          required
          maxLength={254}
        />
      </Field>
      <Field label="Matrícula" id="registration" required>
        <Input
          id="registration"
          value={data.registrationNumber}
          onChange={(e) => update("registrationNumber", e.target.value)}
          required
          maxLength={40}
        />
      </Field>
      <Field
        label="CPF ou identificador funcional"
        id="identifier"
        hint="Use somente um identificador fictício nesta demonstração."
      >
        <Input
          id="identifier"
          value={data.functionalIdentifier || ""}
          onChange={(e) => update("functionalIdentifier", e.target.value)}
          maxLength={50}
          aria-describedby="identifier-hint"
        />
      </Field>
    </div>
  );
  const access = (
    <div className="form-grid">
      <Field
        label="Perfil de acesso"
        id="accessProfile"
        required
        hint={
          user?.id === viewerId
            ? "O próprio perfil exige alteração por outra pessoa da Direção."
            : undefined
        }
      >
        <Select
          id="accessProfile"
          value={data.accessProfile}
          onChange={(e) => update("accessProfile", e.target.value as AccessProfile)}
          disabled={user?.id === viewerId}
        >
          {Object.entries(profileLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Categoria profissional" id="professionalCategoryId" required>
        <Select
          id="professionalCategoryId"
          value={data.professionalCategoryId}
          onChange={(e) => update("professionalCategoryId", e.target.value)}
          required
        >
          <option value="">Selecione</option>
          {refs.categories.map((item) => (
            <option key={item.id} value={item.id} disabled={!item.active}>
              {item.name}
              {!item.active ? " (inativa)" : ""}
            </option>
          ))}
        </Select>
      </Field>
      {!userId && (
        <Field label="Status" id="status">
          <Select
            id="status"
            value={data.status}
            onChange={(e) => update("status", e.target.value as UserStatus)}
          >
            <option value="ACTIVE">Ativo</option>
            <option value="INACTIVE">Inativo</option>
          </Select>
        </Field>
      )}
    </div>
  );
  const unit = (
    <div className="narrow-form">
      <Field label="Unidade principal" id="primaryUnitId" required>
        <Select
          id="primaryUnitId"
          value={data.primaryUnitId}
          onChange={(e) => update("primaryUnitId", e.target.value)}
          required
        >
          <option value="">Selecione</option>
          {refs.units.map((item) => (
            <option key={item.id} value={item.id} disabled={!item.active}>
              {item.name}
              {!item.active ? " (inativa)" : ""}
            </option>
          ))}
        </Select>
      </Field>
      <p className="muted small" style={{ marginTop: 15 }}>
        O vínculo a unidades adicionais está preparado para refinamento futuro.
      </p>
    </div>
  );
  return (
    <>
      <Link href="/users" className="back-link">
        <ArrowLeft size={15} />
        Gestão de usuários
      </Link>
      <PageHeader
        eyebrow="Gestão"
        title={userId ? user?.name || "Detalhes do usuário" : "Novo usuário"}
        description={
          user
            ? "Matrícula " + user.registrationNumber
            : "Informe os dados de acesso e o vínculo institucional."
        }
        actions={
          user && (
            <Badge variant={user.status === "ACTIVE" ? "success" : "neutral"}>
              {statusLabels[user.status]}
            </Badge>
          )
        }
      />
      {error && (
        <div className="inline-error">
          <Alert variant="error">{error}</Alert>
        </div>
      )}
      {loading ? (
        <Loading />
      ) : (
        <Card className="form-card">
          <form onSubmit={save}>
            {userId && user ? (
              <>
                <div className="status-controls">
                  <Badge variant={user.status === "ACTIVE" ? "success" : "neutral"}>
                    {statusLabels[user.status]}
                  </Badge>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setConfirm(true)}
                    disabled={saving || user.id === viewerId}
                  >
                    {user.status === "ACTIVE" ? "Inativar usuário" : "Ativar usuário"}
                  </Button>
                </div>
                <Tabs
                  items={[
                    { value: "personal", label: "Dados pessoais", content: personal },
                    { value: "access", label: "Acesso e perfil", content: access },
                    { value: "unit", label: "Unidade", content: unit },
                    {
                      value: "history",
                      label: "Histórico",
                      content: <AuditTable entries={history} />,
                    },
                  ]}
                />
              </>
            ) : (
              <>
                <div className="form-section">
                  <h2>Dados pessoais</h2>
                  {personal}
                </div>
                <div className="form-section">
                  <h2>Acesso e perfil</h2>
                  {access}
                </div>
                <div className="form-section">
                  <h2>Unidade</h2>
                  {unit}
                </div>
                <Alert>
                  Uma senha temporária será gerada. O usuário deverá alterá-la no primeiro acesso.
                </Alert>
              </>
            )}
            <div className="form-actions">
              <Link href="/users" className="button button-secondary">
                Voltar
              </Link>
              <Button type="submit" loading={saving} disabled={!!credential}>
                {saving ? "Salvando..." : userId ? "Salvar alterações" : "Criar usuário"}
              </Button>
            </div>
          </form>
        </Card>
      )}
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={user?.status === "ACTIVE" ? "Inativar usuário?" : "Ativar usuário?"}
        description={
          user?.status === "ACTIVE"
            ? "O acesso será bloqueado imediatamente. O histórico será preservado."
            : "O usuário poderá acessar o sistema novamente."
        }
        confirmLabel={user?.status === "ACTIVE" ? "Inativar" : "Ativar"}
        onConfirm={() => void changeStatus()}
        loading={saving}
        danger={user?.status === "ACTIVE"}
      />
      <Modal
        open={!!credential}
        onOpenChange={(open) => {
          if (!open && user) router.push("/users/" + user.id);
        }}
        title="Usuário criado"
        description="Guarde a senha temporária agora e entregue-a ao usuário por um canal seguro. Ela não será exibida novamente."
      >
        {credential && (
          <>
            <p>
              {credential.name} · {credential.email}
            </p>
            <div className="credential-row">
              <strong>Senha temporária</strong>
              <code>{credential.temporaryPassword}</code>
              <Button
                variant="secondary"
                onClick={() => {
                  void navigator.clipboard
                    .writeText(credential.temporaryPassword)
                    .then(() => toast.success("Senha copiada."))
                    .catch(() =>
                      toast.error("Não foi possível copiar. Selecione a senha manualmente."),
                    );
                }}
              >
                <Copy size={15} />
                Copiar
              </Button>
            </div>
            <p className="muted small" style={{ marginTop: 15 }}>
              Troca obrigatória no primeiro acesso.
            </p>
            <div className="dialog-actions">
              <Button
                onClick={() => {
                  if (user) router.push("/users/" + user.id);
                }}
              >
                Abrir usuário
              </Button>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
