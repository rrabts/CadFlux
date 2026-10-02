import { Brand } from "@/components/brand";
import { ThemeSwitch } from "@/components/theme-switch";
import { LoginForm } from "@/modules/auth/login-form";
export default function Login() {
  return (
    <main className="login-page">
      <div className="login-theme">
        <ThemeSwitch />
      </div>
      <section className="login-card">
        <Brand />
        <div className="eyebrow">GESTÃO DO CADASTRO ÚNICO</div>
        <h1>Bem-vindo ao CadFlux</h1>
        <p className="muted">Acesse seu ambiente de trabalho.</p>
        <LoginForm />
        <div className="login-footer">
          Acesso restrito a profissionais autorizados.
          <br />
          Organização e cuidado em cada etapa.
        </div>
      </section>
      <p className="login-caption">CadFlux · Plataforma de gestão institucional</p>
    </main>
  );
}
