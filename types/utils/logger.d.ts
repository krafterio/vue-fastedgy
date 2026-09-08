export declare const LOG_LEVELS: {
    NONE: string;
    ERROR: string;
    WARNING: string;
    INFO: string;
    DEBUG: string;
};
/**
 * Initialise le logger avec le niveau de log spécifié
 * @param {string} logLevel - Niveau de log (voir LOG_LEVELS)
 */
export declare function initializeLogger(logLevel: string): void;
export declare const logger: {
    error: (...args: any[]) => void;
    warn: (...args: any[]) => void;
    info: (...args: any[]) => void;
    log: (...args: any[]) => void;
    debug: (...args: any[]) => void;
};
//# sourceMappingURL=logger.d.ts.map