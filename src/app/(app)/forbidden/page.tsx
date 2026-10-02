import Link from "next/link";
import { requirePageUser } from "@/modules/auth/service";
import { Card, EmptyState } from "@/components/ui";
export default async function ForbiddenPage() {
  await requirePageUser("account:read");
  return (
    <Card>
      <EmptyState
        title="Acesso não permitido"
        description="Seu perfil não possui acesso a esta área. Procure a Direção se precisar de orientação."
      />
      <div className="empty-action">
        <Link href="/dashboard" className="button button-secondary">
          Voltar para a visão geral
        </Link>
      </div>
    </Card>
  );
}
