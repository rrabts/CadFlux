import Link from "next/link";
import { Building2, ClipboardList, Plus, Send } from "lucide-react";
import { requirePageUser } from "@/modules/auth/service";
import { Card, EmptyState, PageHeader, Badge } from "@/components/ui";
import { profileLabels } from "@/lib/contracts";
export default async function DashboardPage() {
  const user = await requirePageUser("dashboard:read");
  const direction = user.accessProfile === "DIRECTION";
  const referral = user.accessProfile === "REFERRAL_OPERATOR";
  const labels = direction
    ? ["Hoje", "Semana", "Mês", "Unidades ativas"]
    : referral
      ? ["Hoje", "Semana", "Mês", "Pendências"]
      : ["Atendimentos hoje", "Esta semana", "Este mês", "Pendências"];
  const sections = direction
    ? ["Atendimentos por unidade", "Situação dos fechamentos"]
    : referral
      ? ["Últimos encaminhamentos"]
      : ["Resumo da semana", "Total da unidade", "Últimos atendimentos"];
  return (
    <>
      <PageHeader
        eyebrow={profileLabels[user.accessProfile] + " · " + user.primaryUnit.code}
        title="Visão geral"
        description={"Olá, " + user.name.split(" ")[0] + ". Este é o seu espaço de trabalho."}
        actions={
          direction ? (
            <Link href="/users" className="button button-primary">
              Gestão de usuários
            </Link>
          ) : (
            <Link
              className="button button-primary"
              href={referral ? "/workspace/new-referral" : "/workspace/new-service"}
            >
              <Plus size={18} />
              {referral ? "Novo encaminhamento" : "Novo atendimento"}
            </Link>
          )
        }
      />
      <div className="phase-note">
        <Badge variant="info">Fase 1</Badge>
        <p>Fundação e acesso disponíveis. Os módulos operacionais aguardam desenvolvimento.</p>
      </div>
      <div className="stats-grid">
        {labels.map((label) => (
          <Card className="stat-card" key={label}>
            <span>{label}</span>
            <strong aria-label="Sem dados nesta fase">—</strong>
            <small>Disponível em uma próxima fase</small>
          </Card>
        ))}
      </div>
      <div className={"dashboard-grid " + (referral ? "single-column" : "")}>
        {sections.map((title, index) => (
          <Card className={"dashboard-card " + (index === 2 ? "full-width" : "")} key={title}>
            <div className="card-heading">
              <h2>{title}</h2>
              <span className="muted small">Em desenvolvimento</span>
            </div>
            <EmptyState
              title="Nenhum registro disponível"
              description="Este módulo será disponibilizado em uma próxima fase. Não há dados operacionais nesta demonstração."
              icon={
                direction ? (
                  <Building2 size={25} />
                ) : referral ? (
                  <Send size={25} />
                ) : (
                  <ClipboardList size={25} />
                )
              }
            />
          </Card>
        ))}
      </div>
    </>
  );
}
