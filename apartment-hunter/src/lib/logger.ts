/**
 * Application-wide logger.
 *
 * Intentionally avoids pino.transport() / pino-pretty as a transport because
 * both rely on worker threads (thread-stream), which break inside Next.js's
 * webpack runtime — the worker tries to load a file path that webpack has
 * moved to .next/server/vendor-chunks/ where it no longer exists.
 *
 * Dev:  human-readable lines to stdout via console.log
 * Prod: newline-delimited JSON to stdout (structured, parseable by log aggregators)
 */

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 } as const;
type Level = keyof typeof LEVELS;

const isDev = process.env.NODE_ENV !== "production";
const configuredLevel = (process.env.LOG_LEVEL ?? (isDev ? "debug" : "info")) as Level;
const minLevel = LEVELS[configuredLevel] ?? LEVELS.info;

const DEV_PREFIX: Record<Level, string> = {
  debug: "DBG",
  info:  "INF",
  warn:  "WRN",
  error: "ERR",
};

// JSON.stringify(new Error()) returns "{}" — serialize Error objects explicitly
function serializeValue(v: unknown): unknown {
  if (v instanceof Error) {
    return {
      name: v.name,
      message: v.message,
      ...(v.cause !== undefined ? { cause: serializeValue(v.cause) } : {}),
    };
  }
  return v;
}

function serializeBindings(bindings: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(bindings)) {
    out[k] = serializeValue(v);
  }
  return out;
}

function formatTime(): string {
  return new Date().toTimeString().slice(0, 8);
}

function log(level: Level, bindings: Record<string, unknown>, msg: string): void {
  if (LEVELS[level] < minLevel) return;

  const serialized = serializeBindings(bindings);

  if (isDev) {
    const extras = Object.keys(serialized).length > 0
      ? " " + JSON.stringify(serialized)
      : "";
    console.log(`${formatTime()} ${DEV_PREFIX[level]} ${msg}${extras}`);
  } else {
    process.stdout.write(
      JSON.stringify({
        level,
        time: Date.now(),
        msg,
        app: "apartment-hunter-poa",
        ...serialized,
      }) + "\n"
    );
  }
}

// Supports both pino call signatures:
//   logger.info("message")
//   logger.info({ key: value }, "message")
function makeMethod(level: Level) {
  return (bindingsOrMsg: Record<string, unknown> | string, msg?: string) => {
    if (typeof bindingsOrMsg === "string") {
      log(level, {}, bindingsOrMsg);
    } else {
      log(level, bindingsOrMsg, msg ?? "");
    }
  };
}

const logger = {
  debug: makeMethod("debug"),
  info:  makeMethod("info"),
  warn:  makeMethod("warn"),
  error: makeMethod("error"),
};

export default logger;
