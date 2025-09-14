/*
 * Copyright Krafter SAS <developer@krafter.io>
 * MIT License (see LICENSE file).
 */

export const LOG_LEVELS = {
  NONE: 'none',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info',
  DEBUG: 'debug',
};

const DEFAULT_LOG_LEVEL = LOG_LEVELS.INFO;

let loggerLevel = DEFAULT_LOG_LEVEL;

/**
 * Initialise le logger avec le niveau de log spécifié
 * @param {string} logLevel - Niveau de log (voir LOG_LEVELS)
 */
export function initializeLogger(logLevel) {
  loggerLevel = logLevel || DEFAULT_LOG_LEVEL;

  const originalConsole = {
    error: console.error,
    warn: console.warn,
    info: console.info,
    log: console.log,
    debug: console.debug,
  };

  console.error = function(...args) {
    if (loggerLevel !== LOG_LEVELS.NONE) {
      originalConsole.error(...args);
    }
  };

  console.warn = function(...args) {
    if ([LOG_LEVELS.WARNING, LOG_LEVELS.INFO, LOG_LEVELS.DEBUG].includes(loggerLevel)) {
      originalConsole.warn(...args);
    }
  };

  console.info = function(...args) {
    if ([LOG_LEVELS.INFO, LOG_LEVELS.DEBUG].includes(loggerLevel)) {
      originalConsole.info(...args);
    }
  };

  console.log = function(...args) {
    if ([LOG_LEVELS.INFO, LOG_LEVELS.DEBUG].includes(loggerLevel)) {
      originalConsole.log(...args);
    }
  };

  console.debug = function(...args) {
    if (loggerLevel === LOG_LEVELS.DEBUG) {
      originalConsole.debug(...args);
    }
  };
}

export const logger = {
  error: (...args) => console.error(...args),
  warn: (...args) => console.warn(...args),
  info: (...args) => console.info(...args),
  log: (...args) => console.log(...args),
  debug: (...args) => console.debug(...args),
};
