type Category = "query" | "tool" | "storage" | "provider" | "session";
type Level = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: Level;
  category: Category;
  message: string;
  data?: Record<string, unknown>;
  timestamp: number;
}

const LOG_BUFFER: LogEntry[] = [];
const MAX_BUFFER = 100;

function log(
  level: Level,
  category: Category,
  message: string,
  data?: Record<string, unknown>,
) {
  const entry: LogEntry = {
    level,
    category,
    message,
    data,
    timestamp: Date.now(),
  };
  LOG_BUFFER.push(entry);
  if (LOG_BUFFER.length > MAX_BUFFER) LOG_BUFFER.shift();

  // Console output with color coding
  const colors: Record<Level, string> = {
    debug: "color: #9ca3af",
    info: "color: #3b82f6",
    warn: "color: #f59e0b",
    error: "color: #ef4444",
  };
  console.log(`%c[gyoza:${category}] ${message}`, colors[level], data || "");

  // Persist errors to storage
  if (level === "error") {
    chrome.storage.local
      .get("gyozai_error_log")
      .then(({ gyozai_error_log: existing }) => {
        const errorLog = existing || [];
        errorLog.push(entry);
        if (errorLog.length > 100) errorLog.splice(0, errorLog.length - 100);
        chrome.storage.local.set({ gyozai_error_log: errorLog });
      })
      .catch(() => {});
  }
}

export const logger = {
  debug: (cat: Category, msg: string, data?: Record<string, unknown>) =>
    log("debug", cat, msg, data),
  info: (cat: Category, msg: string, data?: Record<string, unknown>) =>
    log("info", cat, msg, data),
  warn: (cat: Category, msg: string, data?: Record<string, unknown>) =>
    log("warn", cat, msg, data),
  error: (cat: Category, msg: string, data?: Record<string, unknown>) =>
    log("error", cat, msg, data),
  getBuffer: () => [...LOG_BUFFER],
};
