export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData)) headers.set("Content-Type", "application/json");
  const response = await fetch(path, { ...options, headers, credentials: "same-origin" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && !path.includes("/auth/login")) window.location.assign("/login");
    throw new ApiError(data.error?.message || (typeof data.error === "string" ? data.error : data.message) || "Não foi possível concluir a operação. Tente novamente.", response.status);
  }
  return data as T;
}
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Não foi possível concluir a operação.";
}
export function formatDate(value: string | Date | null | undefined, withTime = false): string {
  if (!value) return "Ainda não registrado";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", ...(withTime ? { timeStyle: "short" as const } : {}), timeZone: "America/Sao_Paulo" }).format(new Date(value));
}
