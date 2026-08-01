type LogLevel = "info" | "warn" | "error";
type LogData = Record<string, string | number | boolean | null | undefined>;

const sensitive = /password|secret|token|cookie|authorization|recovery|totp/i;
function sanitize(data: LogData) {
  return Object.fromEntries(Object.entries(data).filter(([key, value]) => !sensitive.test(key) && value !== undefined));
}

export function log(level: LogLevel, event: string, data: LogData = {}) {
  const entry = JSON.stringify({ timestamp: new Date().toISOString(), level, event, ...sanitize(data) });
  if (level === "error") console.error(entry);
  else if (level === "warn") console.warn(entry);
  else console.info(entry);
}

export function errorDetails(error: unknown) {
  if (error instanceof Error) return { errorName: error.name, errorMessage: error.message.slice(0, 500) };
  return { errorName: "UnknownError", errorMessage: "Non-error value thrown" };
}
