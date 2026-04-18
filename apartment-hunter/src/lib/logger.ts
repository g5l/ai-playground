/**
 * Application-wide logger using pino.
 * In development: pretty-printed output via pino-pretty.
 * In production: structured JSON output.
 */

import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";

const logger = pino(
  {
    level: process.env.LOG_LEVEL ?? (isDev ? "debug" : "info"),
    base: {
      pid: process.pid,
      app: "apartment-hunter-poa",
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  },
  isDev
    ? pino.transport({
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:HH:MM:ss",
          ignore: "pid,hostname",
        },
      })
    : undefined
);

export default logger;
