import { requirePage } from "@/server/auth";
import { PageHeader, Card } from "@/components/ui";
import { ProfileForm } from "@/modules/auth/profile-form";
import { profileLabels } from "@/lib/contracts";
export default async function Profile() {
  const user = await requirePage("account:read");
  return (
    <>
      <PageHeader title="Meu perfil" description={`${user.name} · ${user.registrationNumber}`} />
      <div className="two-column">
        <Card>
          <h2>Dados da conta</h2>
          <dl>
            <dt>E-mail</dt>
            <dd>{user.email}</dd>
            <dt>Perfil</dt>
            <dd>{profileLabels[user.accessProfile]}</dd>
            <dt>Categoria</dt>
            <dd>{user.professionalCategory.name}</dd>
            <dt>Unidade</dt>
            <dd>{user.primaryUnit.name}</dd>
          </dl>
        </Card>
        <ProfileForm required={user.mustChangePassword} />
      </div>
    </>
  );
}
