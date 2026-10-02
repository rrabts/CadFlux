import { Brand } from "@/components/brand";
import { RecoveryForm } from "@/components/auth-forms";
import { ThemeSwitch } from "@/components/theme-switch";
export default function RecoveryPage() {
  return (
    <main className="auth-page">
      <div className="auth-theme">
        <ThemeSwitch />
      </div>
      <div className="auth-card">
        <Brand />
        <div className="auth-heading">
          <h1>Recuperar acesso</h1>
          <p>
            A recuperação está preparada. O envio de mensagens será disponibilizado em uma próxima
            fase.
          </p>
        </div>
        <RecoveryForm />
      </div>
    </main>
  );
}
