"use client";
import { useState } from "react";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api-client";
import { Button, Card, PageHeader, Alert, Input, Field, ConfirmDialog } from "@/components/ui";
type Preview = {
  id: string;
  total: number;
  valid: number;
  invalid: number;
  duplicates: number;
  rows: { line: number; data: { nome: string; email: string }; errors: string[] }[];
};
export function ImportWizard() {
  const [preview, setPreview] = useState<Preview | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [confirm, setConfirm] = useState(false),
    [credentials, setCredentials] = useState<{ email: string; temporaryPassword: string }[]>([]);
  return (
    <>
      <PageHeader
        title="Importar usuários"
        description="1. Arquivo → 2. Validação → 3. Revisão → 4. Confirmação"
      />
      <Card>
        <h2>Prepare o arquivo</h2>
        <p>
          CSV UTF-8 ou XLSX, até 2 MB e 500 usuários. Use os códigos das unidades e os nomes exatos
          das categorias. Perfis: INTERVIEWER, REFERRAL_OPERATOR ou DIRECTION. Status: ACTIVE ou
          INACTIVE.
        </p>
        <a className="button button-secondary" href="/api/imports/template" download>
          Baixar template CSV
        </a>
        <p className="muted">Não inclua senhas, fórmulas ou arquivos SQL.</p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            setPreview(null);
            setCredentials([]);
            try {
              setPreview(
                await api<Preview>("/api/imports/preview", {
                  method: "POST",
                  body: new FormData(e.currentTarget),
                }),
              );
              toast.success("Validação concluída");
            } catch (e) {
              setError(errorMessage(e));
              toast.error("Falha na validação.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label="Arquivo de usuários" id="file">
            <Input id="file" name="file" type="file" accept=".csv,.xlsx" required />
          </Field>
          <Button loading={busy}>{busy ? "Validando..." : "Validar arquivo"}</Button>
        </form>
      </Card>
      {error && <Alert variant="error">{error}</Alert>}
      {preview && (
        <Card>
          <h2>Revise antes de confirmar</h2>
          <div className="stats-grid">
            {[
              ["Total", preview.total],
              ["Válidos", preview.valid],
              ["Inválidos", preview.invalid],
              ["Duplicados", preview.duplicates],
            ].map(([label, count]) => (
              <div key={label}>
                <p>{label}</p>
                <strong className="stat-value">{count}</strong>
              </div>
            ))}
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Linha</th>
                  <th>Nome</th>
                  <th>E-mail</th>
                  <th>Validação</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row) => (
                  <tr key={row.line}>
                    <td>{row.line}</td>
                    <td>{row.data.nome}</td>
                    <td>{row.data.email}</td>
                    <td>{row.errors.length ? row.errors.join("; ") : "Válido"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Alert variant={preview.invalid ? "warning" : "info"}>
            {preview.invalid
              ? "Corrija as linhas inválidas e envie o arquivo novamente. Nenhum usuário foi criado."
              : "Nenhum usuário foi criado ainda. A confirmação revalida os dados e importa todo o arquivo em uma única transação."}
          </Alert>
          <Button disabled={preview.invalid > 0 || busy} onClick={() => setConfirm(true)}>
            Confirmar importação
          </Button>
        </Card>
      )}
      {credentials.length > 0 && (
        <Card>
          <h2>Importação concluída</h2>
          <Alert variant="warning">
            Entregue as senhas por canal seguro. São exibidas somente nesta tela e exigem troca no
            primeiro acesso.
          </Alert>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>E-mail</th>
                  <th>Senha temporária</th>
                </tr>
              </thead>
              <tbody>
                {credentials.map((c) => (
                  <tr key={c.email}>
                    <td>{c.email}</td>
                    <td>
                      <code>{c.temporaryPassword}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button variant="secondary" onClick={() => setCredentials([])}>
            Ocultar senhas
          </Button>
        </Card>
      )}
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Confirmar importação?"
        description={`Serão criados ${preview?.valid ?? 0} usuários. Esta confirmação só pode ser usada uma vez.`}
        confirmLabel="Importar usuários"
        loading={busy}
        onConfirm={async () => {
          if (!preview) return;
          setBusy(true);
          setError("");
          try {
            setCredentials(await api(`/api/imports/${preview.id}/confirm`, { method: "POST" }));
            setPreview(null);
            setConfirm(false);
            toast.success("Usuários importados");
          } catch (e) {
            setError(errorMessage(e));
            setConfirm(false);
            toast.error("Falha ao importar.");
          } finally {
            setBusy(false);
          }
        }}
      />
    </>
  );
}
