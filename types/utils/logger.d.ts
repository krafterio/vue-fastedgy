/**
 * Initialise le logger avec le niveau de log spécifié
 * @param {string} logLevel - Niveau de log (voir LOG_LEVELS)
 */
export function initializeLogger(logLevel: string): void;
export namespace LOG_LEVELS {
    let NONE: string;
    let ERROR: string;
    let WARNING: string;
    let INFO: string;
    let DEBUG: string;
}
export namespace logger {
    function error(...args: any[]): void;
    function warn(...args: any[]): void;
    function info(...args: any[]): void;
    function log(...args: any[]): void;
    function debug(...args: any[]): void;
}
//# sourceMappingURL=logger.d.ts.map