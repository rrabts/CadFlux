import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { ThemeSwitch } from "@/components/theme-switch";
import { LoginForm } from "@/components/auth-forms";
import { Alert } from "@/components/ui";
import { getCurrentUser } from "@/modules/auth/service";
export const dynamic = "force-dynamic";
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ password?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect(user.mustChangePassword ? "/change-password" : "/dashboard");
  const query = await searchParams;
  return (
    <main className="auth-page">
      <div className="auth-theme">
        <ThemeSwitch />
      </div>
      <div className="auth-card">
        <Brand />
        <div className="auth-heading">
          <p className="eyebrow">GESTÃO DO CADASTRO ÚNICO</p>
          <h1>Bem-vindo ao CadFlux</h1>
          <p>Acesse sua unidade de trabalho.</p>
        </div>
        {query.password === "changed" && (
          <div className="inline-error">
            <Alert variant="success">Senha alterada. Entre novamente com sua nova senha.</Alert>
          </div>
        )}
        <LoginForm />
        <div className="auth-note">Ambiente de desenvolvimento · dados fictícios</div>
      </div>
      <footer className="auth-footer">CadFlux · Plataforma de gestão institucional</footer>
    </main>
  );
}
