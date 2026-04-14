/**
 * PNW Structured Logger
 *
 * Privacy-preserving client-side logger with:
 *   - Level control (debug/info/warn/error/off) via NEXT_PUBLIC_LOG_LEVEL
 *   - Tag filtering via NEXT_PUBLIC_LOG_TAGS (comma-separated, e.g. "PNW-CRED,PNW-SCAN")
 *   - Structured event data ({ tag, event, timestamp, traceId, ...data })
 *   - Session trace ID for correlating logs across a single user session
 *   - In-memory ring buffer (last 200 entries) accessible via log.dump()
 *   - Performance timing via log.time() / log.timeEnd()
 *   - Zero dependencies, zero network calls, zero data leaves the browser
 *
 * Usage:
 *   import { log } from "@/src/lib/logger";
 *
 *   log.debug("PNW-PAYROLL", "record_selected", { amount: 700000 });
 *   log.info("PNW-CRED", "mint_broadcast", { txId: "at1..." });
 *   log.warn("PNW-SCAN", "wallet_cache_slow", { attempt: 3, delayMs: 4000 });
 *   log.error("PNW-TX", "transaction_rejected", { error: "input ID exists" });
 *
 *   log.time("payroll-worker-1");
 *   // ... work ...
 *   log.timeEnd("payroll-worker-1"); // logs duration automatically
 *
 *   const lines = log.dump(); // returns the last 200 structured log entries
 *   const text = log.dumpText(); // returns them as a copyable string
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type LogLevel = "debug" | "info" | "warn" | "error" | "off";

type LogEntry = {
  level: LogLevel;
  tag: string;
  event: string;
  timestamp: string;
  traceId: string;
  durationMs?: number;
  data?: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  off: 4,
};

const RING_BUFFER_SIZE = 200;

// ---------------------------------------------------------------------------
// Circular-safe JSON serializer
// ---------------------------------------------------------------------------

/** JSON.stringify that replaces circular references with "[Circular]"
 *  instead of throwing. Safe for arbitrary app state objects. */
function safeStringify(obj: unknown): string {
  const seen = new WeakSet();
  try {
    return JSON.stringify(obj, (_key, value) => {
      if (typeof value === "object" && value !== null) {
        if (seen.has(value)) return "[Circular]";
        seen.add(value);
      }
      return value;
    });
  } catch {
    return "[Unserializable]";
  }
}

// ---------------------------------------------------------------------------
// Session trace ID — unique per page load, persists across navigations
// within the same SPA session
// ---------------------------------------------------------------------------

function generateTraceId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${ts}-${rand}`;
}

let _traceId: string | null = null;

function getTraceId(): string {
  if (!_traceId) {
    // Try to reuse from sessionStorage so SPA navigations keep the same trace
    if (typeof window !== "undefined") {
      try {
        _traceId = sessionStorage.getItem("pnw_trace_id");
        if (!_traceId) {
          _traceId = generateTraceId();
          sessionStorage.setItem("pnw_trace_id", _traceId);
        }
      } catch {
        _traceId = generateTraceId();
      }
    } else {
      _traceId = generateTraceId();
    }
  }
  return _traceId;
}

// ---------------------------------------------------------------------------
// Level + tag resolution
// ---------------------------------------------------------------------------

function getLevel(): number {
  try {
    const env = process.env.NEXT_PUBLIC_LOG_LEVEL;
    return LEVELS[env as LogLevel] ?? LEVELS.debug;
  } catch {
    return LEVELS.debug;
  }
}

function getAllowedTags(): Set<string> | null {
  try {
    const env = process.env.NEXT_PUBLIC_LOG_TAGS;
    if (!env || env.trim() === "" || env.trim() === "*") return null; // null = all tags
    return new Set(env.split(",").map((t) => t.trim().toUpperCase()));
  } catch {
    return null;
  }
}

function isTagAllowed(tag: string): boolean {
  const allowed = getAllowedTags();
  if (!allowed) return true; // no filter = all tags pass
  return allowed.has(tag.toUpperCase());
}

// ---------------------------------------------------------------------------
// Ring buffer
// ---------------------------------------------------------------------------

const buffer: LogEntry[] = [];

function pushEntry(entry: LogEntry): void {
  buffer.push(entry);
  if (buffer.length > RING_BUFFER_SIZE) {
    buffer.shift();
  }
}

// ---------------------------------------------------------------------------
// Performance timers
// ---------------------------------------------------------------------------

const timers = new Map<string, number>();

// ---------------------------------------------------------------------------
// Core emit
// ---------------------------------------------------------------------------

function emit(
  level: LogLevel,
  tag: string,
  event: string,
  data?: Record<string, unknown>,
): void {
  if (LEVELS[level] < getLevel()) return;
  if (!isTagAllowed(tag)) return;

  const entry: LogEntry = {
    level,
    tag,
    event,
    timestamp: new Date().toISOString(),
    traceId: getTraceId(),
    ...(data ? { data } : {}),
  };

  pushEntry(entry);

  // Format for console: [TAG] event {data}
  const prefix = `[${tag}]`;
  const consoleFn =
    level === "error"
      ? console.error
      : level === "warn"
        ? console.warn
        : level === "info"
          ? console.info
          : console.log;

  if (data && Object.keys(data).length > 0) {
    consoleFn(prefix, event, data);
  } else {
    consoleFn(prefix, event);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const log = {
  debug(tag: string, event: string, data?: Record<string, unknown>): void {
    emit("debug", tag, event, data);
  },

  info(tag: string, event: string, data?: Record<string, unknown>): void {
    emit("info", tag, event, data);
  },

  warn(tag: string, event: string, data?: Record<string, unknown>): void {
    emit("warn", tag, event, data);
  },

  error(tag: string, event: string, data?: Record<string, unknown>): void {
    emit("error", tag, event, data);
  },

  /**
   * Start a performance timer. Call log.timeEnd(label) to stop it
   * and emit a debug log with the duration.
   */
  time(label: string): void {
    timers.set(label, performance.now());
  },

  /**
   * End a performance timer and emit a debug log with the duration.
   * Routes through emit() so level/tag filters apply — if the level
   * is set above debug or the tag is filtered out, the timing entry
   * is neither printed NOR buffered, matching the advertised behavior.
   * Returns the elapsed milliseconds (or -1 if no matching timer).
   */
  timeEnd(label: string, tag?: string): number {
    const start = timers.get(label);
    if (start === undefined) return -1;
    timers.delete(label);

    const durationMs = Math.round(performance.now() - start);
    emit("debug", tag ?? "PNW-PERF", `${label} completed`, { durationMs });
    return durationMs;
  },

  /**
   * Get the current session trace ID. Useful for displaying in UI
   * so users can report it with bug reports.
   */
  getTraceId(): string {
    return getTraceId();
  },

  /**
   * Return the last N log entries from the ring buffer (default: all).
   */
  dump(limit?: number): LogEntry[] {
    const n = limit ?? buffer.length;
    return buffer.slice(-n);
  },

  /**
   * Return the ring buffer as a human-readable text block suitable
   * for copy-pasting into a bug report. Includes the trace ID header.
   * Uses a circular-safe JSON serializer so cyclic objects in data
   * payloads don't crash the export.
   */
  dumpText(limit?: number): string {
    const entries = log.dump(limit);
    const header = `PNW Debug Log — Trace: ${getTraceId()} — ${new Date().toISOString()}\n${"=".repeat(60)}\n`;
    const lines = entries.map((e) => {
      const dur = e.durationMs !== undefined ? ` (${e.durationMs}ms)` : "";
      const data = e.data ? ` ${safeStringify(e.data)}` : "";
      return `${e.timestamp} [${e.level.toUpperCase()}] [${e.tag}] ${e.event}${dur}${data}`;
    });
    return header + lines.join("\n");
  },

  /**
   * Clear the ring buffer. Useful in tests or when starting a fresh
   * operation (e.g. beginning a new payroll run).
   */
  clear(): void {
    buffer.length = 0;
  },
};

export type { LogEntry, LogLevel };
