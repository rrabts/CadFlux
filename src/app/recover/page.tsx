import Link from "next/link";
import { Brand } from "@/components/brand";
export default function Recover() {
  return (
    <main className="login-page">
      <section className="login-card">
        <Brand />
        <h1>Recuperar acesso</h1>
        <p>
          Entre em contato com a Direção da sua unidade para orientação. O envio automático de
          recuperação por e-mail será disponibilizado em uma próxima etapa.
        </p>
        <Link className="button button-primary" href="/login">
          Voltar ao login
        </Link>
      </section>
    </main>
  );
}
