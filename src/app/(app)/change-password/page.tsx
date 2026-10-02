import { requirePageUser } from "@/modules/auth/service";
import { PasswordForm } from "@/components/auth-forms";
import { Card, PageHeader } from "@/components/ui";
export default async function ChangePasswordPage() {
  const user = await requirePageUser("account:password");
  return (
    <>
      <PageHeader
        eyebrow="Conta"
        title="Alterar senha"
        description="Mantenha seu acesso pessoal e seguro."
      />
      <Card className="form-card">
        <PasswordForm mandatory={user.mustChangePassword} />
      </Card>
    </>
  );
}
