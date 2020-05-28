"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const write_1 = require("./write");
/**
 * This class represents an individual, buffered
 * batch write operation. Key-Value pairs can be added
 * until execute is called and the function is run.
 */
class WriteOperation {
    /**
     * Creates the write operation, but doesn't
     * execute it straight away
     */
    constructor(params, dbConnector) {
        this.params = params;
        this.dbConnector = dbConnector;
        this.writeBuffer = {};
        this.callbacks = [];
    }
    /**
     * Add a Key-Value pair to the write operation.
     * Callback will be invoked once the entire batch is
     * written
     */
    add(key, version, value, callback) {
        this.writeBuffer[key] = { version, value };
        this.callbacks.push(callback);
    }
    /**
     * Executes this write operation and subsequently destroys it
     */
    execute() {
        // tslint:disable-next-line: no-unused-expression
        new write_1.Write(this.params, this.writeBuffer, this.callbacks, this.dbConnector);
        this.writeBuffer = {};
        this.callbacks = [];
    }
    isEmpty() {
        return this.callbacks.length === 0;
    }
}
exports.WriteOperation = WriteOperation;
//# sourceMappingURL=write-operation.js.map