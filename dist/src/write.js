"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const UNDEFINED_TABLE = '42P01';
/**
 * A single write operation to the database. Should the table
 * the write is destined for not exist this class will create
 * it and retry the operation
 */
class Write {
    /**
     * Creates the class and immediatly invokes the first
     * write attempt
     */
    constructor(params, writeBuffer, callbacks, dbConnector) {
        this.params = params;
        this.writeBuffer = writeBuffer;
        this.callbacks = callbacks;
        this.dbConnector = dbConnector;
        this.write();
    }
    /**
     * Executes the write. Composes the statement
     * and sends it to the database
     */
    write() {
        const statement = this.dbConnector.statements.set(this.params, this.writeBuffer);
        this.dbConnector.query(statement, this.onWriteResult.bind(this), [], true);
    }
    /**
     * Invoked once the first or second write attempt finishes
     */
    onWriteResult(error, result) {
        if (error && error.code === UNDEFINED_TABLE) {
            this.createTable();
        }
        else if (error) {
            this.end(error);
        }
        else {
            this.end(null);
        }
    }
    /**
     * Creates a new table and retries the write upon completion
     */
    createTable() {
        this.dbConnector.query(this.dbConnector.statements.createTable({ ...this.params, owner: this.dbConnector.options.role || this.dbConnector.options.user }), (error) => {
            if (error) {
                this.end(error);
            }
            this.write();
        }, []);
    }
    /**
     * Invokes all callbacks and destroys the class
     */
    end(error) {
        for (let i = 0; i < this.callbacks.length; i++) {
            this.callbacks[i](error ? error.toString() : null);
        }
    }
}
exports.Write = Write;
//# sourceMappingURL=write.js.map