"use client";
import { useState, useEffect, useCallback } from "react";
import { api, errorMessage } from "@/lib/api-client";
import { Button, Input, Field, Card, Modal, Alert, Badge } from "@/components/ui";
import { toast } from "sonner";
type RecordItem = { id: string; name: string; active: boolean; code?: string; timezone?: string };
export function ReferenceManager({ kind }: { kind: "units" | "categories" }) {
  const [rows, setRows] = useState<RecordItem[]>([]),
    [editing, setEditing] = useState<RecordItem | null | undefined>(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    try {
      const data = await api<{ units: RecordItem[]; categories: RecordItem[] }>("/api/references");
      setRows(data[kind]);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [kind]);
  useEffect(() => {
    let active = true;
    api<{ units: RecordItem[]; categories: RecordItem[] }>("/api/references")
      .then((data) => {
        if (active) setRows(data[kind]);
      })
      .catch((e) => {
        if (active) setError(errorMessage(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [kind]);
  return (
    <>
      <Button onClick={() => setEditing(null)}>
        + {kind === "units" ? "Nova unidade" : "Nova categoria"}
      </Button>
      {error && <Alert variant="error">{error}</Alert>}
      <Card>
        {loading ? (
          <p role="status">Carregando...</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  {kind === "units" && (
                    <>
                      <th>Código</th>
                      <th>Fuso horário</th>
                    </>
                  )}
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.name}</td>
                    {kind === "units" && (
                      <>
                        <td>{row.code}</td>
                        <td>{row.timezone}</td>
                      </>
                    )}
                    <td>
                      <Badge variant={row.active ? "success" : "neutral"}>
                        {row.active ? "Ativo" : "Inativo"}
                      </Badge>
                    </td>
                    <td>
                      <Button variant="ghost" onClick={() => setEditing(row)}>
                        Editar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Modal
        open={editing !== undefined}
        onOpenChange={(open) => {
          if (!open && !busy) setEditing(undefined);
        }}
        title={editing ? "Editar cadastro" : "Novo cadastro"}
      >
        <form
          key={editing?.id ?? "new"}
          onSubmit={async (e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            setBusy(true);
            setError("");
            const data = {
              name: form.get("name"),
              active: form.get("active") === "on",
              ...(kind === "units"
                ? { code: form.get("code"), timezone: form.get("timezone") }
                : {}),
            };
            try {
              await api(`/api/${kind}${editing ? "/" + editing.id : ""}`, {
                method: editing ? "PATCH" : "POST",
                body: JSON.stringify(data),
              });
              setEditing(undefined);
              toast.success("Salvo");
              await load();
            } catch (e) {
              setError(errorMessage(e));
              toast.error("Falha ao salvar.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label="Nome" id="reference-name">
            <Input
              id="reference-name"
              name="name"
              defaultValue={editing?.name}
              required
              maxLength={100}
            />
          </Field>
          {kind === "units" && (
            <>
              <Field label="Código" id="code">
                <Input
                  id="code"
                  name="code"
                  defaultValue={editing?.code}
                  required
                  pattern="[A-Z0-9_-]+"
                  maxLength={30}
                />
              </Field>
              <Field label="Fuso horário" id="timezone">
                <Input
                  id="timezone"
                  name="timezone"
                  defaultValue={editing?.timezone ?? "America/Sao_Paulo"}
                  required
                />
              </Field>
            </>
          )}
          <label className="checkbox-label">
            <input type="checkbox" name="active" defaultChecked={editing?.active ?? true} /> Ativo
          </label>
          {error && <Alert variant="error">{error}</Alert>}
          <Button loading={busy}>{busy ? "Salvando..." : "Salvar"}</Button>
        </form>
      </Modal>
    </>
  );
}
