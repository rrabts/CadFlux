import { notFound } from "next/navigation";
import { requirePage } from "@/server/auth";
import { getWorkspacePage } from "@/lib/navigation";
import { PageHeader, Card, EmptyState } from "@/components/ui";
import { ReferenceManager } from "@/modules/units/reference-manager";
import { AuditTable } from "@/modules/audit/audit-table";
export default async function Workspace({ params }: { params: Promise<{ slug: string }> }) {
  const user = await requirePage("dashboard:read");
  const { slug } = await params;
  const page = getWorkspacePage(user.accessProfile, slug);
  if (!page) notFound();
  if (["units", "categories", "audit"].includes(slug))
    await requirePage(slug === "audit" ? "audit:read" : "users:manage");
  return (
    <>
      <PageHeader title={page.label} />
      {slug === "units" || slug === "categories" ? (
        <ReferenceManager kind={slug} />
      ) : slug === "audit" ? (
        <AuditTable />
      ) : (
        <Card>
          <EmptyState
            title="Em desenvolvimento"
            description="Este módulo será disponibilizado em uma próxima fase do CadFlux."
          />
          {slug.includes("pending") && (
            <ul className="pending-types">
              {[
                "CPF aguardando verificação",
                "Conflito documental",
                "Registro incompleto",
                "Possível duplicidade",
                "Erro de fechamento",
                "Problema de importação",
              ].map((t) => (
                <li key={t}>{t} — em desenvolvimento</li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </>
  );
}
