import { DeepstreamPlugin, DeepstreamLogger, LOG_LEVEL, NamespacedLogger, EVENT, MetaData } from '@deepstream/types';
export declare class StdOutLogger extends DeepstreamPlugin implements DeepstreamLogger {
    description: string;
    private currentLogLevel;
    /**
     * Logs to the operatingsystem's standard-out and standard-error streams.
     *
     * Consoles / Terminals as well as most log-managers and logging systems
     * consume messages from these streams
     */
    constructor();
    whenReady(): Promise<void>;
    shouldLog(logLevel: number): boolean;
    debug(event: EVENT, logMessage: string): void;
    info(event: EVENT, logMessage: string): void;
    warn(event: EVENT, logMessage: string, metaData?: MetaData): void;
    error(event: EVENT, logMessage: string, metaData?: MetaData): void;
    fatal(event: EVENT, logMessage: string): void;
    getNameSpace(namespace: string): NamespacedLogger;
    /**
     * Sets the log-level. This can be called at runtime.
     */
    setLogLevel(logLevel: LOG_LEVEL): void;
    /**
     * Logs a line
     */
    private log;
}
