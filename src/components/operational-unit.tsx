"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, errorMessage } from "@/lib/api-client";
import type { Configuration } from "@/modules/operations/contracts";
import { Select } from "./ui";
export function OperationalUnitControl() {
  const router = useRouter();
  const [context, setContext] = useState<Configuration | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    const load = () =>
      api<Configuration>("/api/operations")
        .then((d) => {
          if (live) setContext(d);
        })
        .catch((e) => {
          if (live) setError(errorMessage(e));
        });
    void load();
    window.addEventListener("cadflux-unit-changed", load);
    window.addEventListener("focus", load);
    return () => {
      live = false;
      window.removeEventListener("cadflux-unit-changed", load);
      window.removeEventListener("focus", load);
    };
  }, []);
  async function choose(unitId: string) {
    setBusy(true);
    setError("");
    try {
      await api("/api/operations", { method: "PATCH", body: JSON.stringify({ unitId }) });
      window.dispatchEvent(new Event("cadflux-unit-changed"));
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="operational-unit">
      <Select
        aria-label="Local de atendimento padrão"
        disabled={busy || !context?.selected}
        value={context?.selected?.id ?? ""}
        onChange={(e) => void choose(e.target.value)}
      >
        <option value="" disabled>
          {context ? "Local indisponível" : "Carregando local…"}
        </option>
        {context?.units.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
          </option>
        ))}
      </Select>
      {(error || context?.notice) && <small role="status">{error || context?.notice}</small>}
    </div>
  );
}
