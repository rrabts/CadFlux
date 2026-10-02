import Link from "next/link";
import { requirePageUser } from "@/modules/auth/service";
import { profileLabels, statusLabels } from "@/lib/contracts";
import { formatDate } from "@/lib/api-client";
import { Badge, Card, PageHeader } from "@/components/ui";
export default async function ProfilePage() {
  const user = await requirePageUser("account:read");
  return (
    <>
      <PageHeader
        eyebrow="Conta"
        title="Meu perfil"
        description="Suas informações de acesso e vínculo institucional."
        actions={
          <Link href="/change-password" className="button button-secondary">
            Alterar senha
          </Link>
        }
      />
      <Card className="form-card">
        <div className="detail-heading">
          <span className="avatar avatar-large">{user.name[0]}</span>
          <div>
            <h2>{user.name}</h2>
            <p>Matrícula {user.registrationNumber}</p>
          </div>
          <Badge variant="success">{statusLabels[user.status]}</Badge>
        </div>
        <dl className="data-grid">
          <div>
            <dt>E-mail</dt>
            <dd>{user.email}</dd>
          </div>
          <div>
            <dt>Perfil de acesso</dt>
            <dd>{profileLabels[user.accessProfile]}</dd>
          </div>
          <div>
            <dt>Categoria profissional</dt>
            <dd>{user.professionalCategory.name}</dd>
          </div>
          <div>
            <dt>Unidade</dt>
            <dd>{user.primaryUnit.name}</dd>
          </div>
          <div>
            <dt>Último acesso</dt>
            <dd>{formatDate(user.lastLoginAt, true)}</dd>
          </div>
          <div>
            <dt>Identificador funcional</dt>
            <dd>{user.functionalIdentifier || "Não informado"}</dd>
          </div>
        </dl>
        <p className="muted small">Para alterar seus dados ou vínculos, procure a Direção.</p>
      </Card>
    </>
  );
}
