import Link from "next/link";
import { requirePage } from "@/server/auth";
import { prisma } from "@/lib/db";
import { Card, PageHeader, EmptyState, Badge } from "@/components/ui";
import { profileLabels } from "@/lib/contracts";
export default async function Dashboard() {
  const user = await requirePage("dashboard:read");
  const direction = user.accessProfile === "DIRECTION",
    interviewer = user.accessProfile === "INTERVIEWER";
  const units = direction ? await prisma.unit.count({ where: { active: true } }) : 0;
  const sections = direction
    ? ["Atendimentos por unidade", "Situação dos fechamentos"]
    : interviewer
      ? ["Resumo da semana", "Total geral da unidade", "Últimos atendimentos"]
      : ["Últimos encaminhamentos"];
  return (
    <>
      <PageHeader
        eyebrow={profileLabels[user.accessProfile]}
        title="Visão geral"
        description="Seu espaço de trabalho, organizado."
        actions={<Badge variant="info">Fase 1 · Fundação</Badge>}
      />
      {!direction && (
        <Link
          className="button button-primary new-action"
          href={interviewer ? "/workspace/new-service" : "/workspace/new-referral"}
        >
          + {interviewer ? "Novo atendimento" : "Novo encaminhamento"}
        </Link>
      )}
      <div className="stats-grid">
        {[
          interviewer ? "Atendimentos hoje" : "Hoje",
          "Esta semana",
          "Este mês",
          direction ? "Unidades ativas" : "Pendências",
        ].map((label, i) => (
          <Card key={label}>
            <p className="stat-label">{label}</p>
            <strong className="stat-value">{direction && i === 3 ? units : "—"}</strong>
            <small className="muted">
              {direction && i === 3 ? "Cadastro administrativo" : "Módulo em desenvolvimento"}
            </small>
          </Card>
        ))}
      </div>
      <div className="dashboard-sections">
        {sections.map((section) => (
          <Card key={section}>
            <h2>{section}</h2>
            <EmptyState
              title="Ainda não há informações"
              description="Esta área estará disponível em uma próxima fase. Nenhum atendimento é registrado nesta versão."
              compact
            />
          </Card>
        ))}
      </div>
    </>
  );
}
