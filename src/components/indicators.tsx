"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api-client";
import type { indicators } from "@/modules/indicators/service";
import { formatServiceDate, kindLabels } from "@/modules/attendances/contracts";
import { Alert, Button, Card, Field, Input, Select, Skeleton } from "./ui";
type Data = Omit<Awaited<ReturnType<typeof indicators>>, "recent" | "duplicateItems"> & {
  duplicateItems: { id: string; name: string; serviceDate: string; unitName: string }[];
} & {
  recent: {
    id: string;
    name: string;
    serviceDate: string;
    unitName: string;
    kindName: string | null;
    kind: keyof typeof kindLabels;
  }[];
};
type Options = {
  units: { id: string; name: string }[];
  operators: { id: string; name: string; registrationNumber: string }[];
};
export function IndicatorDashboard({ direction }: { direction: boolean }) {
  const [duplicatePage, setDuplicatePage] = useState(1);
  const [data, setData] = useState<Data | null>(null),
    [error, setError] = useState(""),
    [reload, setReload] = useState(0),
    [loaded, setLoaded] = useState("");
  const [draft, setDraft] = useState({ from: "", to: "", unitId: "", ownerUserId: "" }),
    [filters, setFilters] = useState(draft),
    [page, setPage] = useState(1),
    [options, setOptions] = useState<Options>({ units: [], operators: [] });
  const qs = new URLSearchParams({ page: String(page), duplicatePage: String(duplicatePage) });
  for (const [k, v] of Object.entries(filters)) if (v) qs.set(k, v);
  const query = qs.toString(),
    key = query + "@" + reload;
  useEffect(() => {
    if (!direction) return;
    let live = true;
    api<Options>("/api/attendances/options")
      .then((d) => {
        if (live) setOptions(d);
      })
      .catch((e) => {
        if (live) setError(errorMessage(e));
      });
    return () => {
      live = false;
    };
  }, [direction]);
  useEffect(() => {
    let live = true;
    api<Data>("/api/indicators?" + query)
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
        if (live) setLoaded(key);
      });
    return () => {
      live = false;
    };
  }, [query, key]);
  useEffect(() => {
    const refresh = () => setReload((n) => n + 1);
    window.addEventListener("focus", refresh);
    window.addEventListener("cadflux-unit-changed", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("cadflux-unit-changed", refresh);
    };
  }, []);
  return (
    <>
      <form
        className="filter-bar"
        onSubmit={(e) => {
          e.preventDefault();
          setFilters({ ...draft });
          setPage(1);
          setDuplicatePage(1);
          setReload((n) => n + 1);
        }}
      >
        <Field label="De" id="indicator-from">
          <Input
            id="indicator-from"
            type="date"
            value={draft.from}
            onChange={(e) => setDraft({ ...draft, from: e.target.value })}
          />
        </Field>
        <Field label="Até" id="indicator-to">
          <Input
            id="indicator-to"
            type="date"
            value={draft.to}
            onChange={(e) => setDraft({ ...draft, to: e.target.value })}
          />
        </Field>
        {direction && (
          <>
            <Field label="Unidade" id="indicator-unit">
              <Select
                id="indicator-unit"
                value={draft.unitId}
                onChange={(e) => setDraft({ ...draft, unitId: e.target.value })}
              >
                <option value="">Todas</option>
                {options.units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Operador" id="indicator-owner">
              <Select
                id="indicator-owner"
                value={draft.ownerUserId}
                onChange={(e) => setDraft({ ...draft, ownerUserId: e.target.value })}
              >
                <option value="">Todos</option>
                {options.operators.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} · {u.registrationNumber}
                  </option>
                ))}
              </Select>
            </Field>
          </>
        )}
        <Button type="submit">Atualizar indicadores</Button>
      </form>
      {loaded !== key ? (
        <div role="status" aria-label="Carregando indicadores">
          <Skeleton />
          <Skeleton />
        </div>
      ) : error ? (
        <Alert variant="error">{error}</Alert>
      ) : (
        data && (
          <>
            <p className="muted small">
              {data.scope} · {formatServiceDate(data.from)} a {formatServiceDate(data.to)} ·{" "}
              {data.timezone} · Atualizado em{" "}
              {new Intl.DateTimeFormat("pt-BR", {
                dateStyle: "short",
                timeStyle: "short",
                timeZone: data.timezone,
              }).format(new Date(data.updatedAt))}
            </p>
            <div className="stats-grid">
              {[
                ["Atendimentos hoje", data.today.total],
                ["Esta semana", data.week.total],
                ["Este mês", data.month.total],
                ...(direction ? [["Unidades ativas", data.activeUnits]] : []),
              ].map(([label, value]) => (
                <Card className="stat-card" key={String(label)}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                  <small>
                    {label === "Unidades ativas"
                      ? "Cadastro atual · independe do período"
                      : "Ativos · períodos correntes"}
                  </small>
                </Card>
              ))}
            </div>
            <div className="dashboard-grid">
              <Card className="indicator-card dashboard-card">
                <h2>Resumo do período</h2>
                <dl className="indicator-values">
                  {[
                    ["Total de atendimentos", data.range.total],
                    ["Orientações (incluídas no total)", data.range.guidance],
                    ["Demais atendimentos", data.range.total - data.range.guidance],
                    ["Com parecer", data.range.withOpinion],
                    ["Sem parecer", data.range.withoutOpinion],
                    ["Aguardando classificação", data.range.pending],
                    ["Cancelados (fora do total)", data.range.cancelled],
                  ].map(([label, value]) => (
                    <div key={String(label)}>
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
              </Card>
              <Card className="indicator-card dashboard-card">
                <h2>Possíveis duplicidades</h2>
                <p>
                  {data.duplicates.groups} grupo(s) · {data.duplicates.records} registro(s)
                  envolvidos
                </p>
                <p className="muted small">
                  Mesmo operador, CPF e data. Os registros continuam no total; os grupos não são
                  somáveis entre unidades.
                </p>
                <ul>
                  {data.duplicateItems.map((a) => (
                    <li key={a.id}>
                      <Link href={"/attendances/" + a.id}>{a.name}</Link> ·{" "}
                      {formatServiceDate(a.serviceDate)} · {a.unitName}
                    </li>
                  ))}
                </ul>
                <div className="reference-actions">
                  <Button
                    variant="secondary"
                    disabled={duplicatePage === 1}
                    onClick={() => setDuplicatePage((n) => n - 1)}
                  >
                    Duplicidades anteriores
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={duplicatePage * 50 >= data.duplicates.records}
                    onClick={() => setDuplicatePage((n) => n + 1)}
                  >
                    Mais duplicidades
                  </Button>
                </div>
              </Card>
              {!direction && (
                <Card className="indicator-card dashboard-card">
                  <h2>Total da unidade</h2>
                  {data.unitTotal ? (
                    <p>
                      {data.unitTotal.name}: <strong>{data.unitTotal.total}</strong> atendimento(s)
                      no período.
                    </p>
                  ) : (
                    <p>Unidade operacional indisponível. Solicite regularização.</p>
                  )}
                  <p className="muted small">
                    Somente total agregado, sem dados individuais da equipe.
                  </p>
                </Card>
              )}
              <Card className="indicator-card dashboard-card">
                <h2>Atendimentos por tipo</h2>
                <dl className="indicator-values">
                  {data.kinds.map((k) => (
                    <div key={k.code}>
                      <dt>{k.name}</dt>
                      <dd>{k.total}</dd>
                    </div>
                  ))}
                </dl>
                {!data.kinds.length && <p>Sem atendimentos no período.</p>}
              </Card>
              <Card className="indicator-card dashboard-card full-width">
                <h2>Consolidado mensal</h2>
                <p className="muted small">
                  Contagens pela data do atendimento dentro do período selecionado; não representa
                  fechamento ou RMA oficial.
                </p>
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Mês</th>
                        <th>Total</th>
                        <th>Orientações</th>
                        <th>Com parecer</th>
                        <th>Sem parecer</th>
                        <th>Aguardando</th>
                        <th>Cancelados</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.monthly.map((m) => (
                        <tr key={m.month}>
                          <td>{m.month}</td>
                          <td>{m.total}</td>
                          <td>{m.guidance}</td>
                          <td>{m.withOpinion}</td>
                          <td>{m.withoutOpinion}</td>
                          <td>{m.pending}</td>
                          <td>{m.cancelled}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
              {direction && (
                <Card className="indicator-card dashboard-card full-width">
                  <h2>Atendimentos por unidade e operador</h2>
                  <div className="table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Unidade</th>
                          <th>Operador</th>
                          <th>Ativos</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.breakdown.map((b) => (
                          <tr key={b.unitId + b.ownerUserId}>
                            <td>{b.unitName}</td>
                            <td>{b.operatorName}</td>
                            <td>{b.total}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="table-footer reference-pagination">
                    <span>
                      {data.breakdownTotal} combinação(ões) · Página {page}
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
                      disabled={page * 50 >= data.breakdownTotal}
                      onClick={() => setPage((n) => n + 1)}
                    >
                      Próxima
                    </Button>
                  </div>
                </Card>
              )}
              <Card className="indicator-card dashboard-card full-width">
                <h2>Últimos atendimentos</h2>
                {data.recent.length ? (
                  <div className="table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Data</th>
                          <th>Responsável</th>
                          <th>Tipo registrado</th>
                          <th>Unidade registrada</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.recent.map((a) => (
                          <tr key={a.id}>
                            <td>{formatServiceDate(a.serviceDate)}</td>
                            <td>
                              <Link href={"/attendances/" + a.id}>{a.name}</Link>
                            </td>
                            <td>{a.kindName ?? kindLabels[a.kind]}</td>
                            <td>{a.unitName}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p>Sem atendimentos no período.</p>
                )}
              </Card>
            </div>
          </>
        )
      )}
      <div className="phase-note">
        <p>Pendências e situação dos fechamentos: indisponíveis nesta fase.</p>
      </div>
    </>
  );
}
