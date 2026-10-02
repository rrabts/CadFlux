"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api-client";
import { Button, Input, Field, Alert, Card } from "@/components/ui";
export function ProfileForm({ required }: { required: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <Card>
      <h2>Segurança da conta</h2>
      {required && (
        <Alert variant="warning">Altere sua senha temporária para acessar os módulos.</Alert>
      )}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          const data = new FormData(e.currentTarget);
          if (data.get("newPassword") !== data.get("confirm")) {
            setError("As senhas não coincidem.");
            setBusy(false);
            return;
          }
          try {
            await api("/api/auth/password", {
              method: "POST",
              body: JSON.stringify({
                currentPassword: data.get("currentPassword"),
                newPassword: data.get("newPassword"),
              }),
            });
            toast.success("Senha alterada. Entre novamente.");
            router.replace("/login");
            router.refresh();
          } catch (error) {
            setError(errorMessage(error));
            toast.error("Falha ao salvar.");
            setBusy(false);
          }
        }}
      >
        {[
          ["currentPassword", "Senha atual"],
          ["newPassword", "Nova senha (mínimo 12 caracteres)"],
          ["confirm", "Confirme a nova senha"],
        ].map(([id, label]) => (
          <Field key={id} label={label} id={id}>
            <Input
              id={id}
              name={id}
              type="password"
              autoComplete={id === "currentPassword" ? "current-password" : "new-password"}
              minLength={id === "currentPassword" ? 1 : 12}
              maxLength={128}
              required
            />
          </Field>
        ))}
        {error && <Alert variant="error">{error}</Alert>}
        <Button loading={busy}>{busy ? "Salvando..." : "Alterar senha"}</Button>
      </form>
      <p className="muted">
        A alteração encerra todas as suas sessões. MFA para Direção está previsto para uma próxima
        fase.
      </p>
    </Card>
  );
}
