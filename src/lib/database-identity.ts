type DatabaseIdentity = { host: string; port: number; name: string };

function databaseIdentity(value: string): DatabaseIdentity {
  try {
    const url = new URL(value);
    if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") throw new Error();
    const host = url.hostname.toLowerCase().replace(/\.$/, "");
    const port = Number(url.port || 5432);
    const name = decodeURIComponent(url.pathname.slice(1));
    if (
      !host ||
      !name ||
      name.includes("\0") ||
      !Number.isInteger(port) ||
      port < 1 ||
      port > 65535
    )
      throw new Error();
    return { host: host === "localhost" ? "127.0.0.1" : host, port, name };
  } catch {
    throw new Error("Configure uma URL PostgreSQL válida com host, porta e nome do banco.");
  }
}

/** Credentials and schema options do not identify a separate PostgreSQL database. */
export function isSameDatabase(first: string, second: string): boolean {
  const left = databaseIdentity(first);
  const right = databaseIdentity(second);
  return left.host === right.host && left.port === right.port && left.name === right.name;
}
