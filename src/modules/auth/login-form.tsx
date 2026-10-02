"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Button, Input, Field, Alert } from "@/components/ui";
import { api, errorMessage } from "@/lib/api-client";
export function LoginForm() {
  const router = useRouter();
  const [show, setShow] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError("");
        const form = new FormData(event.currentTarget);
        try {
          await api("/api/auth/login", {
            method: "POST",
            body: JSON.stringify({ login: form.get("login"), password: form.get("password") }),
          });
          router.replace("/dashboard");
          router.refresh();
        } catch (error) {
          setError(errorMessage(error));
          toast.error("Falha ao entrar.");
          setBusy(false);
        }
      }}
    >
      <Field label="E-mail ou matrícula" id="login">
        <Input id="login" name="login" autoComplete="username" required autoFocus />
      </Field>
      <Field label="Senha" id="password">
        <div className="password-field">
          <Input
            id="password"
            name="password"
            type={show ? "text" : "password"}
            autoComplete="current-password"
            required
            maxLength={256}
          />
          <button
            type="button"
            className="icon-button"
            aria-label={show ? "Ocultar senha" : "Mostrar senha"}
            onClick={() => setShow(!show)}
          >
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </Field>
      {error && <Alert variant="error">{error}</Alert>}
      <Button className="full-width" loading={busy}>
        {busy ? "Entrando..." : "Entrar"}
        <ArrowRight size={17} />
      </Button>
      <Link className="recovery-link" href="/recover">
        Esqueci minha senha
      </Link>
    </form>
  );
}
