"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import { api, errorMessage } from "@/lib/api-client";
import { Alert, Button, Field, Input } from "./ui";

function PasswordInput({
  id,
  autoComplete,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="password-field">
      <Input {...props} id={id} type={visible ? "text" : "password"} autoComplete={autoComplete} />
      <button
        type="button"
        className="icon-button"
        aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
        aria-pressed={visible}
        onClick={() => setVisible(!visible)}
      >
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}
export function LoginForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const values = new FormData(event.currentTarget);
    try {
      const result = await api<{
        mustChangePassword?: boolean;
        user?: { mustChangePassword: boolean };
      }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: values.get("email"), password: values.get("password") }),
      });
      router.replace(
        result.mustChangePassword || result.user?.mustChangePassword
          ? "/change-password"
          : "/dashboard",
      );
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
      setLoading(false);
    }
  }
  return (
    <form onSubmit={submit} className="stack" aria-label="Entrar no CadFlux">
      {error && <Alert variant="error">{error}</Alert>}
      <Field label="E-mail" id="email" required>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          placeholder="seu.email@instituicao.gov.br"
          required
          autoFocus
        />
      </Field>
      <Field label="Senha" id="password" required>
        <PasswordInput id="password" name="password" autoComplete="current-password" required />
      </Field>
      <Button type="submit" loading={loading} className="button-full">
        <LockKeyhole size={17} />
        {loading ? "Entrando..." : "Entrar"}
      </Button>
      <Link href="/recovery" className="text-link centered">
        Esqueci minha senha
      </Link>
    </form>
  );
}
export function RecoveryForm() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const values = new FormData(event.currentTarget);
    try {
      const result = await api<{ message?: string }>("/api/auth/recovery", {
        method: "POST",
        body: JSON.stringify({ email: values.get("email") }),
      });
      setMessage(
        result.message ||
          "Solicitação recebida. Nesta fase, procure a Direção para orientação sobre o acesso.",
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }
  return (
    <form onSubmit={submit} className="stack">
      {error && <Alert variant="error">{error}</Alert>}
      {message ? (
        <Alert>{message}</Alert>
      ) : (
        <>
          <Field label="E-mail cadastrado" id="recovery-email" required>
            <Input id="recovery-email" name="email" type="email" autoComplete="email" required />
          </Field>
          <Button loading={loading}>{loading ? "Enviando..." : "Solicitar orientação"}</Button>
        </>
      )}
      <Link href="/login" className="text-link centered">
        Voltar para o login
      </Link>
    </form>
  );
}
export function PasswordForm({ mandatory = false }: { mandatory?: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const values = new FormData(event.currentTarget);
    if (values.get("newPassword") !== values.get("confirmation")) {
      setError("A confirmação deve ser igual à nova senha.");
      return;
    }
    setLoading(true);
    try {
      await api("/api/auth/password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword: values.get("currentPassword"),
          newPassword: values.get("newPassword"),
        }),
      });
      setSaved(true);
      router.replace("/login?password=changed");
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }
  return (
    <form onSubmit={submit} className="stack narrow-form">
      {mandatory && (
        <Alert variant="warning">
          Sua senha é temporária. Defina uma nova senha para acessar o CadFlux.
        </Alert>
      )}
      {error && <Alert variant="error">{error}</Alert>}
      {saved && <Alert variant="success">Senha alterada com sucesso.</Alert>}
      <Field label="Senha atual" id="currentPassword" required>
        <PasswordInput
          id="currentPassword"
          name="currentPassword"
          autoComplete="current-password"
          required
        />
      </Field>
      <Field
        label="Nova senha"
        id="newPassword"
        required
        hint="Use pelo menos 12 caracteres, com letras e números."
      >
        <PasswordInput
          id="newPassword"
          name="newPassword"
          autoComplete="new-password"
          minLength={12}
          required
          aria-describedby="newPassword-hint"
        />
      </Field>
      <Field label="Confirmar nova senha" id="confirmation" required>
        <PasswordInput
          id="confirmation"
          name="confirmation"
          autoComplete="new-password"
          minLength={12}
          required
        />
      </Field>
      <Button loading={loading} type="submit">
        {loading ? "Salvando..." : "Alterar senha"}
      </Button>
    </form>
  );
}
