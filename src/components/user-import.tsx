"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, Download, FileSpreadsheet, Upload } from "lucide-react";
import { api, errorMessage } from "@/lib/api-client";
import { Alert, Badge, Button, Card, ConfirmDialog, Field, Input, PageHeader } from "./ui";
type PreviewRow = {
  line: number;
  values: Record<string, string>;
  data: { name?: string; email?: string; registrationNumber?: string };
  errors: string[];
  duplicate: boolean;
};
type Preview = {
  batchId: string;
  fileName: string;
  total: number;
  valid: number;
  invalid: number;
  duplicates: number;
  rows: PreviewRow[];
  expiresAt: string;
};
type Result = {
  created: number;
  credentials: { name: string; email: string; temporaryPassword: string }[];
};
export function UserImport() {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false);
  async function validate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      setPreview(await api<Preview>("/api/imports/preview", { method: "POST", body: data }));
      setResult(null);
    } catch (err) {
      setError(errorMessage(err));
      setPreview(null);
    } finally {
      setLoading(false);
    }
  }
  async function importUsers() {
    if (!preview) return;
    setLoading(true);
    setError("");
    try {
      setResult(
        await api<Result>("/api/imports/confirm", {
          method: "POST",
          body: JSON.stringify({ batchId: preview.batchId }),
        }),
      );
      setPreview(null);
      setConfirm(false);
    } catch (err) {
      setError(errorMessage(err));
      setConfirm(false);
      setPreview(null);
    } finally {
      setLoading(false);
    }
  }
  return (
    <>
      <Link className="back-link" href="/users">
        <ArrowLeft size={15} />
        Gestão de usuários
      </Link>
      <PageHeader
        eyebrow="Gestão"
        title="Importar usuários"
        description="Valide e revise o arquivo antes de confirmar a criação dos acessos."
      />
      <div className="import-steps" aria-label="Etapas da importação">
        <span className={!preview && !result ? "active" : ""}>1. Arquivo</span>
        <span className={preview ? "active" : ""}>2. Validação</span>
        <span className={preview ? "active" : ""}>3. Revisão</span>
        <span className={result ? "active" : ""}>4. Confirmação</span>
      </div>
      {error && (
        <div className="inline-error">
          <Alert variant="error">
            {error} Se necessário, envie o arquivo novamente para uma nova prévia.
          </Alert>
        </div>
      )}
      {result ? (
        <Card className="form-card">
          <Alert variant="success">
            {result.created} usuário{result.created === 1 ? "" : "s"} criado
            {result.created === 1 ? "" : "s"} com sucesso.
          </Alert>
          <h2 style={{ marginTop: 24 }}>Senhas temporárias</h2>
          <p className="muted small" style={{ marginTop: 8 }}>
            Guarde estas credenciais agora. Elas não serão exibidas novamente. A troca é obrigatória
            no primeiro acesso.
          </p>
          <div className="table-container" style={{ marginTop: 20 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>E-mail</th>
                  <th>Senha temporária</th>
                </tr>
              </thead>
              <tbody>
                {result.credentials.map((item) => (
                  <tr key={item.email}>
                    <td>{item.name}</td>
                    <td>{item.email}</td>
                    <td>
                      <code>{item.temporaryPassword}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="form-actions">
            <Button
              variant="secondary"
              onClick={() => {
                setResult(null);
                setPreview(null);
              }}
            >
              Nova importação
            </Button>
            <Link href="/users" className="button button-primary">
              Ver usuários
            </Link>
          </div>
        </Card>
      ) : preview ? (
        <>
          <div className="summary-grid">
            {[
              ["Total", preview.total],
              ["Válidos", preview.valid],
              ["Inválidos", preview.invalid],
              ["Duplicados", preview.duplicates],
            ].map(([label, count]) => (
              <div className="summary-item" key={label}>
                <strong>{count}</strong>
                <span>{label}</span>
              </div>
            ))}
          </div>
          <div className="stack">
            <Alert variant={preview.invalid ? "warning" : "success"}>
              {preview.invalid
                ? "Corrija as linhas com erros no arquivo e envie uma nova versão. Nenhum usuário foi criado."
                : "Todos os registros foram validados. Revise os dados e confirme a importação."}
            </Alert>
            <Card>
              <div className="card-heading">
                <h2>{preview.fileName}</h2>
                <Badge variant="info">Prévia</Badge>
              </div>
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Linha</th>
                      <th>Nome</th>
                      <th>E-mail</th>
                      <th>Matrícula</th>
                      <th>Perfil</th>
                      <th>Categoria / unidade</th>
                      <th>Validação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row) => (
                      <tr key={row.line}>
                        <td>{row.line}</td>
                        <td>{row.values.nome || row.data.name || "—"}</td>
                        <td>{row.values.email || row.data.email || "—"}</td>
                        <td>{row.values.matricula || row.data.registrationNumber || "—"}</td>
                        <td>{row.values.perfil || "—"}</td>
                        <td>
                          {row.values.categoria}
                          <br />
                          <span className="muted">{row.values.unidade}</span>
                        </td>
                        <td>
                          {row.errors.length ? (
                            <ul className="error-list">
                              {row.errors.map((reason, index) => (
                                <li key={index}>{reason}</li>
                              ))}
                            </ul>
                          ) : (
                            <Badge variant="success">Válido</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
          <div className="form-actions">
            <Button variant="secondary" onClick={() => setPreview(null)} disabled={loading}>
              Trocar arquivo
            </Button>
            <Button
              disabled={preview.invalid > 0 || preview.total === 0}
              onClick={() => setConfirm(true)}
              loading={loading}
            >
              Confirmar importação
            </Button>
          </div>
          <ConfirmDialog
            open={confirm}
            onOpenChange={setConfirm}
            title="Confirmar importação?"
            description={
              "Serão criados " +
              preview.valid +
              " usuários com senhas temporárias. Os dados serão revalidados antes da gravação."
            }
            confirmLabel="Criar usuários"
            loading={loading}
            onConfirm={() => void importUsers()}
          />
        </>
      ) : (
        <Card className="form-card">
          <div className="card-heading" style={{ padding: 0, border: 0 }}>
            <h2>Modelo de importação</h2>
            <div className="template-links">
              <a href="/api/imports/template?format=csv" className="text-link">
                <Download size={13} /> CSV
              </a>
              <a href="/api/imports/template?format=xlsx" className="text-link">
                <Download size={13} /> XLSX
              </a>
            </div>
          </div>
          <p className="muted small" style={{ marginTop: 12 }}>
            Colunas: nome, cpf_ou_identificador, email, matricula, perfil, categoria, unidade e
            status. Use INTERVIEWER, REFERRAL_OPERATOR ou DIRECTION no perfil; ACTIVE ou INACTIVE no
            status. Categoria aceita o nome e unidade aceita nome ou código.
          </p>
          <form onSubmit={validate}>
            <div className="upload-panel">
              <FileSpreadsheet size={30} strokeWidth={1.5} aria-hidden />
              <h2 style={{ marginTop: 13 }}>Selecione seu arquivo</h2>
              <p>CSV ou XLSX · até 2 MiB · até 1.000 linhas</p>
              <Field
                label="Arquivo de usuários"
                id="import-file"
                required
                hint="Preencha as células como texto, sem fórmulas, links ou senha. Use somente dados fictícios."
              >
                <Input
                  type="file"
                  id="import-file"
                  name="file"
                  accept=".csv,.xlsx"
                  required
                  aria-describedby="import-file-hint"
                />
              </Field>
            </div>
            <Alert>
              Nenhum usuário é criado durante a validação. A criação exige sua confirmação após a
              revisão.
            </Alert>
            <div className="form-actions">
              <Link href="/users" className="button button-secondary">
                Cancelar
              </Link>
              <Button type="submit" loading={loading}>
                <Upload size={16} />
                {loading ? "Validando..." : "Validar arquivo"}
              </Button>
            </div>
          </form>
        </Card>
      )}
    </>
  );
}
