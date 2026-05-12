/**
 * Structured logger for Folia SaaS.
 * In production, logs are suppressed below 'warn'.
 * Replace with a real logging service (Axiom, Datadog) if needed.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const IS_PROD = process.env.NODE_ENV === 'production'

function log(level: LogLevel, module: string, message: string, data?: unknown) {
  if (IS_PROD && (level === 'debug' || level === 'info')) return

  const timestamp = new Date().toISOString()
  const prefix = `[${timestamp}] [${module}] [${level.toUpperCase()}]`

  if (data !== undefined) {
    // eslint-disable-next-line no-console
    console[level === 'debug' ? 'log' : level](`${prefix} ${message}`, data)
  } else {
    // eslint-disable-next-line no-console
    console[level === 'debug' ? 'log' : level](`${prefix} ${message}`)
  }
}

export const logger = {
  debug: (module: string, msg: string, data?: unknown) => log('debug', module, msg, data),
  info: (module: string, msg: string, data?: unknown) => log('info', module, msg, data),
  warn: (module: string, msg: string, data?: unknown) => log('warn', module, msg, data),
  error: (module: string, msg: string, data?: unknown) => log('error', module, msg, data),
}
