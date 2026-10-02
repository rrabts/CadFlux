import { notFound } from "next/navigation";
import Link from "next/link";
import { requirePageUser } from "@/modules/auth/service";
import { getWorkspacePage } from "@/lib/navigation";
import { Card, EmptyState, PageHeader } from "@/components/ui";
export default async function WorkspacePage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await requirePageUser("dashboard:read");
  const { slug } = await params;
  const page = getWorkspacePage(user.accessProfile, slug);
  if (!page) notFound();
  return (
    <>
      <PageHeader
        title={page.label}
        description="Estrutura preparada para as próximas fases do CadFlux."
      />
      <Card>
        <EmptyState
          title="Em desenvolvimento"
          description="Este módulo ainda não possui operações ou registros. A Fase 1 contempla a fundação, os acessos e a gestão de usuários."
        />
        <div className="empty-action">
          <Link href="/dashboard" className="button button-secondary">
            Voltar para a visão geral
          </Link>
        </div>
      </Card>
    </>
  );
}
