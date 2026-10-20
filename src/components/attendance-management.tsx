"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Plus, ArrowLeft, Search } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError, errorMessage, formatDate } from "@/lib/api-client";
import type { AuditEntry } from "@/lib/contracts";
import {
  type Attendance,
  type AttendanceInput,
  kindLabels,
  opinionLabels,
  permitsOpinion,
  formatServiceDate,
} from "@/modules/attendances/contracts";
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
type PageData = { items: Attendance[]; total: number; page: number; pageSize: number };
type FilterOptions = {
  operators: { id: string; name: string; registrationNumber: string }[];
  units: { id: string; name: string; code: string }[];
};
const initialFilters = {
  q: "",
  from: "",
  to: "",
  kind: "",
  opinion: "",
  status: "active",
  ownerUserId: "",
  unitId: "",
};
export function AttendanceList({ direction }: { direction: boolean }) {
  const [draft, setDraft] = useState(initialFilters);
  const [filters, setFilters] = useState(initialFilters);
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [data, setData] = useState<PageData | null>(null);
  const [options, setOptions] = useState<FilterOptions>({ operators: [], units: [] });
  const [resolvedQuery, setResolvedQuery] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (direction)
      api<FilterOptions>("/api/attendances/options")
        .then(setOptions)
        .catch((e) => setError(errorMessage(e)));
  }, [direction]);
  const query = new URLSearchParams({ page: String(page) });
  for (const [key, value] of Object.entries(filters)) if (value) query.set(key, value);
  const queryKey = query.toString();
  const requestKey = queryKey + "@" + reload;
  const loading = resolvedQuery !== requestKey;
  useEffect(() => {
    let active = true;
    api<PageData>("/api/attendances?" + queryKey)
      .then((result) => {
        if (!active) return;
        const last = Math.max(1, Math.ceil(result.total / result.pageSize));
        if (page > last) {
          setPage(last);
          return;
        }
        setData(result);
        setError("");
      })
      .catch((e) => {
        if (active) {
          setError(errorMessage(e));
          setData(null);
        }
      })
      .finally(() => {
        if (active) setResolvedQuery(requestKey);
      });
    return () => {
      active = false;
    };
  }, [queryKey, page, requestKey]);
  const field = (key: keyof typeof initialFilters, value: string) =>
    setDraft((current) => ({ ...current, [key]: value }));
  return (
    <>
      <PageHeader
        eyebrow="Atendimentos"
        title={direction ? "Atendimentos" : "Meus atendimentos"}
        description={
          direction
            ? "Consulta e correção dos registros da equipe, com histórico."
            : "Registre somente os atendimentos realizados. Você consulta apenas seus próprios registros."
        }
        actions={
          !direction && (
            <Link className="button button-primary" href="/attendances/new">
              <Plus size={17} />
              Novo atendimento
            </Link>
          )
        }
      />
      <form
        className="filter-bar"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setFilters({ ...draft });
          setReload((value) => value + 1);
        }}
      >
        <Field label="Pesquisar nome ou CPF" id="attendance-search">
          <Input
            id="attendance-search"
            value={draft.q}
            maxLength={120}
            onChange={(e) => field("q", e.target.value)}
          />
        </Field>
        <Field label="De" id="attendance-from">
          <Input
            id="attendance-from"
            type="date"
            value={draft.from}
            onChange={(e) => field("from", e.target.value)}
          />
        </Field>
        <Field label="Até" id="attendance-to">
          <Input
            id="attendance-to"
            type="date"
            value={draft.to}
            onChange={(e) => field("to", e.target.value)}
          />
        </Field>
        <Field label="Tipo" id="attendance-kind-filter">
          <Select
            id="attendance-kind-filter"
            value={draft.kind}
            onChange={(e) => field("kind", e.target.value)}
          >
            <option value="">Todos</option>
            {Object.entries(kindLabels).map(([key, name]) => (
              <option key={key} value={key}>
                {name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Parecer" id="attendance-opinion-filter">
          <Select
            id="attendance-opinion-filter"
            value={draft.opinion}
            onChange={(e) => field("opinion", e.target.value)}
          >
            <option value="">Todos</option>
            {Object.entries(opinionLabels).map(([key, name]) => (
              <option key={key} value={key}>
                {name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Situação" id="attendance-status">
          <Select
            id="attendance-status"
            value={draft.status}
            onChange={(e) => field("status", e.target.value)}
          >
            <option value="active">Ativos</option>
            <option value="cancelled">Cancelados</option>
            <option value="all">Todos</option>
          </Select>
        </Field>
        {direction && (
          <>
            <Field label="Operador" id="attendance-operator">
              <Select
                id="attendance-operator"
                value={draft.ownerUserId}
                onChange={(e) => field("ownerUserId", e.target.value)}
              >
                <option value="">Todos</option>
                {options.operators.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} · {u.registrationNumber}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Unidade" id="attendance-unit">
              <Select
                id="attendance-unit"
                value={draft.unitId}
                onChange={(e) => field("unitId", e.target.value)}
              >
                <option value="">Todas</option>
                {options.units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} · {u.code}
                  </option>
                ))}
              </Select>
            </Field>
          </>
        )}
        <div className="filter-actions">
          <Button type="submit" variant="secondary">
            <Search size={16} />
            Filtrar
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setDraft(initialFilters);
              setFilters(initialFilters);
              setPage(1);
            }}
          >
            Limpar
          </Button>
        </div>
      </form>
      {error && !loading && (
        <div className="inline-error">
          <Alert variant="error">{error}</Alert>
        </div>
      )}
      <Card aria-busy={loading}>
        {loading ? (
          <div className="loading-panel">
            <Skeleton />
            <Skeleton />
          </div>
        ) : data && data.items.length ? (
          <>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Responsável familiar / legal</th>
                    <th>Tipo</th>
                    <th>Parecer</th>
                    <th>Situação</th>
                    {direction && <th>Operador / unidade</th>}
                    <th>Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item) => (
                    <tr key={item.id}>
                      <td>{formatServiceDate(item.serviceDate)}</td>
                      <td className="user-cell">
                        <strong>{item.name}</strong>
                        <small>
                          {item.responsibleRole} · {item.cpf}
                        </small>
                      </td>
                      <td>{kindLabels[item.kind]}</td>
                      <td>
                        <Badge variant={item.opinion === "PENDING" ? "warning" : "neutral"}>
                          {opinionLabels[item.opinion]}
                        </Badge>
                      </td>
                      <td>{item.cancelledAt ? "Cancelado" : "Ativo"}</td>
                      {direction && (
                        <td className="user-cell">
                          <strong>{item.operatorName}</strong>
                          <small>{item.unitName}</small>
                        </td>
                      )}
                      <td>
                        <Link
                          className="button button-ghost"
                          aria-label={`Abrir atendimento de ${item.name}`}
                          href={`/attendances/${item.id}`}
                        >
                          Abrir
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="table-footer reference-pagination">
              <span>
                {data.total} registro(s) · Página {page} de{" "}
                {Math.max(1, Math.ceil(data.total / 50))}
              </span>
              <div className="reference-actions">
                <Button
                  variant="secondary"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Anterior
                </Button>
                <Button
                  variant="secondary"
                  disabled={page * 50 >= data.total}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Próxima
                </Button>
              </div>
            </div>
          </>
        ) : (
          <EmptyState
            title="Nenhum atendimento encontrado"
            description="Ajuste os filtros ou registre um atendimento realizado."
          />
        )}
      </Card>
    </>
  );
}
const blank = (today: string): AttendanceInput => ({
  serviceDate: today,
  name: "",
  cpf: "",
  responsibleRole: "RF",
  familyCode: "",
  phone: "",
  kind: "UPDATE_FAMILY",
  opinion: "PENDING",
  crowded: false,
});
type Reusable = Pick<AttendanceInput, "name" | "cpf" | "responsibleRole" | "phone" | "familyCode">;
type Detail = { item: Attendance; history: AuditEntry[]; editable: boolean };
export function AttendanceEditor({
  id,
  today = "",
  contextLabel = "",
}: {
  id?: string;
  today?: string;
  contextLabel?: string;
}) {
  const router = useRouter();
  const [form, setForm] = useState<AttendanceInput>(blank(today));
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(Boolean(id));
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [reused, setReused] = useState(false);
  const [candidate, setCandidate] = useState<Reusable | null>(null);
  const [duplicate, setDuplicate] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [cancelError, setCancelError] = useState("");
  useEffect(() => {
    if (!id) return;
    let active = true;
    api<Detail>(`/api/attendances/${id}`)
      .then((result) => {
        if (!active) return;
        setDetail(result);
        setForm({ ...result.item, serviceDate: result.item.serviceDate.slice(0, 10) });
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
  }, [id]);
  const patch = <K extends keyof AttendanceInput>(key: K, value: AttendanceInput[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  const readonly = Boolean(id && !detail?.editable);
  const personalLocked = readonly || reused;
  const opinionFixed = Boolean(id && detail?.item.opinion !== "PENDING");
  async function save(acknowledged = false) {
    setBusy(true);
    setError("");
    try {
      // Construct the payload explicitly: never send database metadata back as editable fields.
      const payload = {
        serviceDate: form.serviceDate,
        name: form.name,
        cpf: form.cpf,
        responsibleRole: form.responsibleRole,
        familyCode: form.kind === "GUIDANCE" ? null : form.familyCode,
        phone: form.phone || null,
        kind: form.kind,
        opinion: form.opinion,
        crowded: form.crowded,
        duplicateAcknowledged: acknowledged,
        ...(id && detail ? { version: detail.item.version } : {}),
      };
      const item = await api<Attendance>(id ? `/api/attendances/${id}` : "/api/attendances", {
        method: id ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      });
      setDuplicate(false);
      toast.success(id ? "Atendimento atualizado." : "Atendimento registrado.");
      if (id) {
        const next = await api<Detail>(`/api/attendances/${id}`);
        setDetail(next);
        setForm({ ...next.item, serviceDate: next.item.serviceDate.slice(0, 10) });
      } else router.push(`/attendances/${item.id}`);
    } catch (e) {
      if (
        e instanceof ApiError &&
        e.status === 409 &&
        e.message.startsWith("Possível duplicidade:")
      )
        setDuplicate(true);
      else {
        setDuplicate(false);
        setError(errorMessage(e));
      }
    } finally {
      setBusy(false);
    }
  }
  async function lookup() {
    setChecking(true);
    setError("");
    setNote("");
    try {
      const result = await api<{ item: Reusable | null }>("/api/attendances/reuse", {
        method: "POST",
        body: JSON.stringify({ cpf: form.cpf }),
      });
      if (result.item) setCandidate(result.item);
      else setNote("Não há dados anteriores deste CPF entre os seus atendimentos ativos.");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setChecking(false);
    }
  }
  async function cancel() {
    if (!detail || !id) return;
    setBusy(true);
    setCancelError("");
    try {
      await api(`/api/attendances/${id}/cancel`, {
        method: "POST",
        body: JSON.stringify({ version: detail.item.version, reason }),
      });
      const next = await api<Detail>(`/api/attendances/${id}`);
      setDetail(next);
      setCancelOpen(false);
      toast.success("Atendimento cancelado. O histórico foi preservado.");
    } catch (e) {
      setCancelError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  if (loading)
    return (
      <div className="loading-panel">
        <Skeleton />
        <Skeleton />
      </div>
    );
  if (id && !detail)
    return (
      <>
        <Link className="back-link" href="/attendances">
          Voltar aos atendimentos
        </Link>
        <Alert variant="error">{error || "Atendimento não encontrado."}</Alert>
      </>
    );
  return (
    <>
      <Link href="/attendances" className="back-link">
        <ArrowLeft size={15} />
        Voltar aos atendimentos
      </Link>
      <PageHeader
        eyebrow="Atendimentos"
        title={id ? "Detalhe do atendimento" : "Novo atendimento"}
        description={
          id && detail
            ? `${detail.item.operatorName} · ${detail.item.operatorRegistration} · ${detail.item.unitName}`
            : contextLabel
        }
        actions={
          id &&
          detail?.editable && (
            <Button
              variant="danger"
              onClick={() => {
                setCancelError("");
                setCancelOpen(true);
              }}
            >
              Cancelar registro
            </Button>
          )
        }
      />
      {detail?.item.cancelledAt ? (
        <div className="inline-error">
          <Alert variant="warning">
            Cancelado em {formatDate(detail.item.cancelledAt, true)}. Motivo:{" "}
            {detail.item.cancellationReason}. O registro e seu histórico permanecem disponíveis.
          </Alert>
        </div>
      ) : (
        readonly && (
          <div className="inline-error">
            <Alert variant="info">
              A semana deste atendimento encerrou. Solicite correções à Direção.
            </Alert>
          </div>
        )
      )}
      {error && (
        <div className="inline-error">
          <Alert variant="error">{error}</Alert>
        </div>
      )}
      {note && (
        <div className="inline-error">
          <Alert>{note}</Alert>
        </div>
      )}
      <Card className="form-card attendance-form">
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            void save();
          }}
        >
          <fieldset disabled={busy || readonly || checking} className="attendance-fieldset">
            <section className="form-section">
              <h2>Atendimento realizado</h2>
              <div className="form-grid">
                <Field label="Data do atendimento" id="service-date" required>
                  <Input
                    id="service-date"
                    type="date"
                    required
                    value={form.serviceDate}
                    max={today || undefined}
                    onChange={(e) => patch("serviceDate", e.target.value)}
                  />
                </Field>
                <Field label="Tipo de atendimento" id="service-kind" required>
                  <Select
                    id="service-kind"
                    value={form.kind}
                    onChange={(e) => {
                      const kind = e.target.value as AttendanceInput["kind"];
                      setForm((current) => ({
                        ...current,
                        kind,
                        familyCode: kind === "GUIDANCE" ? null : current.familyCode,
                        opinion: permitsOpinion(kind) ? current.opinion : "WITHOUT",
                      }));
                    }}
                  >
                    {Object.entries(kindLabels).map(([key, name]) => (
                      <option
                        key={key}
                        value={key}
                        disabled={
                          opinionFixed &&
                          detail?.item.opinion === "WITH" &&
                          !permitsOpinion(key as AttendanceInput["kind"])
                        }
                      >
                        {name}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            </section>
            <section className="form-section">
              <h2>Responsável familiar / legal</h2>
              <div className="form-grid">
                <Field
                  label="CPF"
                  id="service-cpf"
                  required
                  hint="Validação estrutural. Sem consulta oficial nesta fase."
                >
                  <Input
                    id="service-cpf"
                    inputMode="numeric"
                    required
                    maxLength={14}
                    disabled={Boolean(id) || personalLocked}
                    value={form.cpf}
                    onChange={(e) => {
                      patch("cpf", e.target.value);
                      setNote("");
                    }}
                  />
                </Field>
                <Field label="Responsável" id="service-role" required>
                  <Select
                    id="service-role"
                    disabled={Boolean(id) || personalLocked}
                    value={form.responsibleRole}
                    onChange={(e) => patch("responsibleRole", e.target.value as "RF" | "RL")}
                  >
                    <option value="RF">RF — Responsável familiar</option>
                    <option value="RL">RL — Responsável legal</option>
                  </Select>
                </Field>
              </div>
              {!id && (
                <div className="attendance-lookup">
                  <Button
                    type="button"
                    variant="secondary"
                    loading={checking}
                    disabled={reused || !form.cpf}
                    onClick={lookup}
                  >
                    Consultar meus registros
                  </Button>
                  {reused && (
                    <>
                      <span className="muted small">Dados anteriores reaproveitados.</span>
                      <Button type="button" variant="ghost" onClick={() => setReused(false)}>
                        Editar dados
                      </Button>
                    </>
                  )}
                </div>
              )}
              <div className="form-grid">
                <Field label="Nome completo do RF/RL" id="service-name" required>
                  <Input
                    id="service-name"
                    required
                    minLength={2}
                    maxLength={120}
                    disabled={personalLocked}
                    value={form.name}
                    onChange={(e) => patch("name", e.target.value)}
                  />
                </Field>
                <Field label="Telefone com DDD" id="service-phone" hint="Opcional.">
                  <Input
                    id="service-phone"
                    type="tel"
                    maxLength={25}
                    disabled={personalLocked}
                    value={form.phone || ""}
                    onChange={(e) => patch("phone", e.target.value)}
                  />
                </Field>
                {form.kind !== "GUIDANCE" && (
                  <Field label="Código familiar" id="service-family" required>
                    <Input
                      id="service-family"
                      inputMode="numeric"
                      pattern="[0-9]{1,20}"
                      required
                      maxLength={20}
                      disabled={personalLocked}
                      value={form.familyCode || ""}
                      onChange={(e) => patch("familyCode", e.target.value)}
                    />
                  </Field>
                )}
              </div>
            </section>
            <section className="form-section">
              <h2>Classificação</h2>
              <div className="form-grid">
                <Field
                  label="Parecer"
                  id="service-opinion"
                  hint={
                    opinionFixed
                      ? "Classificação definitiva: não pode ser alterada."
                      : "Depois de definido com ou sem parecer, não poderá ser trocado."
                  }
                >
                  <Select
                    id="service-opinion"
                    disabled={!permitsOpinion(form.kind) || opinionFixed}
                    value={form.opinion}
                    onChange={(e) => patch("opinion", e.target.value as AttendanceInput["opinion"])}
                  >
                    {Object.entries(opinionLabels).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <label className="unit-choice">
                  <input
                    type="checkbox"
                    checked={form.crowded}
                    onChange={(e) => patch("crowded", e.target.checked)}
                  />
                  Atendimento em multidão
                </label>
              </div>
            </section>
          </fieldset>
          {!readonly && (
            <div className="form-actions">
              <Link className="button button-secondary" href="/attendances">
                Voltar sem salvar
              </Link>
              <Button type="submit" loading={busy} disabled={checking}>
                {id ? "Salvar alterações" : "Registrar atendimento"}
              </Button>
            </div>
          )}
        </form>
      </Card>
      {detail && (
        <Card className="attendance-history">
          <div className="card-heading">
            <h2>Histórico do atendimento</h2>
            <span className="muted small">
              Versão {detail.item.version} · {detail.item.timezone}
            </span>
          </div>
          <AuditTable entries={detail.history} />
        </Card>
      )}
      <ConfirmDialog
        open={duplicate}
        onOpenChange={setDuplicate}
        title="Possível duplicidade"
        description="Já existe atendimento ativo deste CPF nesta data entre os registros do responsável. Revise os dados. Você pode confirmar um atendimento distinto; a decisão será auditada."
        confirmLabel="Confirmar registro duplicado"
        loading={busy}
        onConfirm={() => void save(true)}
      />
      <ConfirmDialog
        open={Boolean(candidate)}
        onOpenChange={(open) => {
          if (!open) setCandidate(null);
        }}
        title="Reaproveitar dados anteriores?"
        description="Foi encontrado um registro ativo deste CPF entre os seus atendimentos. Reaproveitar não altera o registro anterior e não confirma os dados em fonte oficial."
        confirmLabel="Reaproveitar dados"
        onConfirm={() => {
          if (candidate) {
            setForm((current) => ({
              ...current,
              ...candidate,
              familyCode: current.kind === "GUIDANCE" ? null : candidate.familyCode,
            }));
            setReused(true);
          }
          setCandidate(null);
        }}
      />
      <Modal
        open={cancelOpen}
        onOpenChange={(open) => {
          if (!busy) setCancelOpen(open);
        }}
        title="Cancelar registro"
        description="O cancelamento é definitivo. O atendimento e o histórico serão preservados."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void cancel();
          }}
        >
          <Field label="Motivo do cancelamento" id="cancel-reason" required>
            <textarea
              className="input attendance-reason"
              id="cancel-reason"
              required
              minLength={5}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={busy}
            />
          </Field>
          {cancelError && <Alert variant="error">{cancelError}</Alert>}
          <div className="dialog-actions">
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => setCancelOpen(false)}
            >
              Voltar
            </Button>
            <Button type="submit" variant="danger" loading={busy}>
              Confirmar cancelamento
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
