/**
 * Structured Logger
 *
 * Provides structured JSON logging using pino.
 * Supports log levels, request tracking, and production-ready formatting.
 *
 * @module lib/logger
 */

import pino from "pino";

/**
 * Log levels
 */
export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

/**
 * Logger configuration
 */
export interface LoggerConfig {
  /** Log level (default: 'info' in production, 'debug' in development) */
  level?: LogLevel;
  /** Enable pretty printing (default: true in development) */
  pretty?: boolean;
  /** Service name for log identification */
  name?: string;
}

/**
 * Create logger configuration based on environment
 */
function createLoggerConfig(config: LoggerConfig = {}): pino.LoggerOptions {
  const isProduction = process.env.NODE_ENV === "production";
  const level = config.level || process.env.LOG_LEVEL || (isProduction ? "info" : "debug");

  const baseConfig: pino.LoggerOptions = {
    level,
    name: config.name || "rox",
    // Add timestamp
    timestamp: pino.stdTimeFunctions.isoTime,
    // Format error objects properly
    serializers: {
      err: pino.stdSerializers.err,
      error: pino.stdSerializers.err,
      req: (req) => ({
        method: req.method,
        url: req.url,
        headers: {
          host: req.headers?.host,
          "user-agent": req.headers?.["user-agent"],
          "content-type": req.headers?.["content-type"],
        },
      }),
      res: (res) => ({
        statusCode: res.statusCode,
      }),
    },
    // Base bindings for all logs
    base: {
      pid: process.pid,
      env: process.env.NODE_ENV || "development",
    },
  };

  return baseConfig;
}

/**
 * Create pino transport for pretty printing in development
 */
function createTransport(config: LoggerConfig = {}): pino.TransportSingleOptions | undefined {
  const isProduction = process.env.NODE_ENV === "production";
  const pretty = config.pretty ?? !isProduction;

  if (pretty) {
    return {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:standard",
        ignore: "pid,hostname,env",
      },
    };
  }

  return undefined;
}

/**
 * Create a configured pino logger instance
 *
 * @param config - Logger configuration
 * @returns Configured pino logger
 *
 * @example
 * ```typescript
 * import { createLogger } from './lib/logger.js';
 *
 * const logger = createLogger({ name: 'api' });
 * logger.info('Server started');
 * logger.error({ err: error }, 'Request failed');
 * ```
 */
export function createLogger(config: LoggerConfig = {}): pino.Logger {
  const loggerConfig = createLoggerConfig(config);
  const transport = createTransport(config);

  if (transport) {
    return pino(loggerConfig, pino.transport(transport));
  }

  return pino(loggerConfig);
}

/**
 * Default application logger
 */
export const logger = createLogger();

/**
 * Request context for logging
 */
export interface RequestContext {
  requestId: string;
  method: string;
  path: string;
  ip?: string;
  userId?: string;
}

/**
 * Create a request-scoped logger
 *
 * @param ctx - Request context
 * @returns Child logger with request context
 */
export function createRequestLogger(ctx: RequestContext): pino.Logger {
  return logger.child({
    requestId: ctx.requestId,
    method: ctx.method,
    path: ctx.path,
    ...(ctx.ip && { ip: ctx.ip }),
    ...(ctx.userId && { userId: ctx.userId }),
  });
}

/**
 * ActivityPub context for logging
 */
export interface ActivityPubContext {
  activityType: string;
  activityId?: string;
  actorUri?: string;
  targetInbox?: string;
}

/**
 * Create an ActivityPub-scoped logger
 *
 * @param ctx - ActivityPub context
 * @returns Child logger with AP context
 */
export function createActivityPubLogger(ctx: ActivityPubContext): pino.Logger {
  return logger.child({
    ap: true,
    activityType: ctx.activityType,
    ...(ctx.activityId && { activityId: ctx.activityId }),
    ...(ctx.actorUri && { actorUri: ctx.actorUri }),
    ...(ctx.targetInbox && { targetInbox: ctx.targetInbox }),
  });
}

export default logger;
