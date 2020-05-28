"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const types_1 = require("@deepstream/types");
const os_1 = require("os");
class StdOutLogger extends types_1.DeepstreamPlugin {
    /**
     * Logs to the operatingsystem's standard-out and standard-error streams.
     *
     * Consoles / Terminals as well as most log-managers and logging systems
     * consume messages from these streams
     */
    constructor() {
        super();
        this.description = 'std out/err';
    }
    async whenReady() {
        this.description = `${this.description} at level ${types_1.LOG_LEVEL[this.currentLogLevel]}`;
    }
    shouldLog(logLevel) {
        return this.currentLogLevel >= logLevel;
    }
    debug(event, logMessage) {
        this.log(types_1.LOG_LEVEL.DEBUG, '', event, logMessage);
    }
    info(event, logMessage) {
        this.log(types_1.LOG_LEVEL.INFO, '', event, logMessage);
    }
    warn(event, logMessage, metaData) {
        this.log(types_1.LOG_LEVEL.WARN, '', event, logMessage, metaData);
    }
    error(event, logMessage, metaData) {
        this.log(types_1.LOG_LEVEL.ERROR, '', event, logMessage, metaData);
    }
    fatal(event, logMessage) {
        this.log(types_1.LOG_LEVEL.FATAL, '', event, logMessage);
    }
    getNameSpace(namespace) {
        return {
            shouldLog: this.shouldLog.bind(this),
            fatal: this.log.bind(this, types_1.LOG_LEVEL.FATAL, namespace),
            error: this.log.bind(this, types_1.LOG_LEVEL.ERROR, namespace),
            warn: this.log.bind(this, types_1.LOG_LEVEL.WARN, namespace),
            info: this.log.bind(this, types_1.LOG_LEVEL.INFO, namespace),
            debug: this.log.bind(this, types_1.LOG_LEVEL.DEBUG, namespace),
        };
    }
    /**
     * Sets the log-level. This can be called at runtime.
     */
    setLogLevel(logLevel) {
        this.currentLogLevel = logLevel;
    }
    /**
     * Logs a line
     */
    log(logLevel, namespace, event, logMessage, metaData = null) {
        if (this.currentLogLevel > logLevel) {
            return;
        }
        const msg = `${namespace ? `${namespace} | ` : ''}${event} | ${logMessage}`;
        let outputStream;
        if (logLevel === types_1.LOG_LEVEL.ERROR || logLevel === types_1.LOG_LEVEL.WARN) {
            outputStream = 'stderr';
        }
        else {
            outputStream = 'stdout';
        }
        process[outputStream].write(msg + os_1.EOL);
    }
}
exports.StdOutLogger = StdOutLogger;
//# sourceMappingURL=std-out-logger.js.map