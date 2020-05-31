"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pg = require("pg");
const pkg = require("../package.json");
const types_1 = require("@deepstream/types");
const statements_1 = require("./statements");
const schema_listener_1 = require("./schema-listener");
const utils_1 = require("./utils");
const std_out_logger_1 = require("./std-out-logger");
const write_operation_1 = require("./write-operation");
const PostgresOptionsDefaults = {
    splitChar: '/',
    idleTimeoutMillis: 200,
    writeInterval: 200,
    defaultTable: 'default',
    notifications: {
        CREATE_TABLE: true,
        DESTROY_TABLE: true,
        INSERT: true,
        UPDATE: true,
        DELETE: true
    }
};
const UNDEFINED_TABLE = '42P01';
const INTERNAL_ERROR = 'XX000';
const DATABASE_IS_STARTING_UP = '57P03';
const CONNECTION_REFUSED = 'ECONNREFUSED';
/**
 * Class deepstream.io postgres database connector
 */
class Connector extends types_1.DeepstreamPlugin {
    constructor(options, services) {
        super();
        this.services = services;
        this.writeOperations = {};
        this.options = { ...PostgresOptionsDefaults, ...options };
        this.description = `Postgres connection to ${this.options.host} and database ${this.options.database} ${pkg.version}`;
        this.statements = new statements_1.Statements(this.options);
        if (this.services) {
            this.logger = this.services.logger.getNameSpace('POSTGRES');
        }
        else {
            const logger = new std_out_logger_1.StdOutLogger();
            this.logger = logger.getNameSpace('POSTGRES');
        }
    }
    init() {
        this.connectionPool = new pg.Pool(this.options);
        this.connectionPool.on('error', this.checkError.bind(this));
        this.schemaListener = new schema_listener_1.SchemaListener(this.connectionPool, this.logger);
        this.flushInterval = setInterval(this.flushWrites.bind(this), this.options.writeInterval);
    }
    async whenReady() {
        return new Promise((resolve, reject) => this.initialise((error) => {
            if (error) {
                reject(error);
            }
            else {
                resolve();
            }
        }));
    }
    async close() {
        return new Promise((resolve) => this.destroy(resolve));
    }
    /**
     * Destroys the connector. Closes the connection pool and
     * all open listeners and stops the write loop
     */
    destroy(callback) {
        clearInterval(this.flushInterval);
        this.schemaListener.destroy();
        this.connectionPool.end(callback);
    }
    createSchema(name, callback) {
        const statement = this.statements.createSchema({ name });
        if (!callback) {
            return new Promise((resolve, reject) => {
                this.query(statement, (err) => err ? reject(err) : resolve(), [], true);
            });
        }
        this.query(statement, callback, [], true);
    }
    destroySchema(name, callback) {
        const statement = this.statements.destroySchema({ name });
        if (!callback) {
            return new Promise((resolve, reject) => {
                this.query(statement, (err) => err ? reject(err) : resolve(), [], true);
            });
        }
        this.query(statement, callback, [], true);
    }
    getSchemaOverview(callbackOrName = this.options.schema, schema) {
        if (typeof callbackOrName === 'string' || callbackOrName === undefined) {
            return new Promise((resolve, reject) => {
                this.getOverview(callbackOrName ? callbackOrName : this.options.schema, (error, tables) => {
                    error ? reject(error) : resolve(tables);
                });
            });
        }
        this.getOverview(schema ? schema : this.options.schema, callbackOrName);
    }
    getOverview(schema, callback) {
        const statement = this.statements.getOverview({ schema });
        this.query(statement, (error, result) => {
            if (error || !result) {
                callback(error);
                return;
            }
            const tables = {};
            for (let i = 0; i < result.rows.length; i++) {
                tables[result.rows[i].table] = result.rows[i].entries;
            }
            callback(null, tables);
        }, [], true);
    }
    /**
     * Subscribes to notifications for actions within a schema. Callback
     * will be invoked every time a table was created or a record was created,
     * updated or deleted
     */
    subscribe(callback, done, schema = this.options.schema) {
        if (!done) {
            return new Promise((resolve) => this.schemaListener.getNotificationsForSchema(schema, callback, resolve));
        }
        this.schemaListener.getNotificationsForSchema(schema, callback, done);
    }
    /**
     * Remove a subscription that was previously established using getNotificationsForSchema
     */
    unsubscribe(callback, done, schema = this.options.schema) {
        if (!done) {
            return new Promise((resolve) => this.schemaListener.unsubscribeFromNotificationsForSchema(schema, callback, resolve));
        }
        this.schemaListener.unsubscribeFromNotificationsForSchema(schema, callback, done);
    }
    /**
    * This will schedule a value to be written to the database. Writes are buffered and overwrite
    * each other. At the end of this.options.writeInterval only the latest value will be written
    */
    set(key, version, value, callback) {
        const params = utils_1.parseDSKey(key, this.options);
        const tableName = params.schema + params.table;
        if (!this.writeOperations[tableName]) {
            this.writeOperations[tableName] = new write_operation_1.WriteOperation(params, this);
        }
        this.writeOperations[tableName].add(params.id, version, value, callback);
    }
    /**
    * Retrieves a value from the database
    */
    get(key, callback) {
        this.query(this.statements.get(utils_1.parseDSKey(key, this.options)), (error, result) => {
            if (error && error.code === UNDEFINED_TABLE) {
                callback(null, -1, null);
            }
            else if (error || !result) {
                callback(error);
            }
            else if (result.rows.length === 0) {
                callback(null, -1, null);
            }
            else {
                const { version } = result.rows[0];
                let { val } = result.rows[0];
                if (typeof val === 'string') {
                    val = JSON.parse(val);
                }
                callback(null, version, val);
            }
        }, [], true);
    }
    /**
    * Deletes a value from the database. If this was the last value for a given table
    * it will also delete the table itself
    */
    delete(key, callback) {
        const statement = this.statements.delete(utils_1.parseDSKey(key, this.options));
        this.query(statement, (error) => callback(error ? error.toString() : null), [], false);
    }
    deleteBulk(recordNames, callback) {
        throw new Error('Method not implemented.');
    }
    /**
     * Low level interface to execute postgreSQL queries.
     */
    query(query, callback, args = [], silent = false) {
        this.connectionPool.connect((error, client, done) => {
            this.checkError(error, client);
            if (error) {
                callback(error);
                return;
            }
            client.query(query, args, (queryError, result) => {
                done();
                if (!silent) {
                    this.checkError(queryError, client);
                }
                callback(queryError, result);
            });
        });
    }
    /**
     * Iterates through the buffered writeOperations every [writeInterval] milliseconds
     * and either executes them if they have pending writes or clears them
     * from the cache
     */
    flushWrites() {
        for (const tableName in this.writeOperations) {
            if (this.writeOperations[tableName].isEmpty()) {
                delete this.writeOperations[tableName];
            }
            else {
                this.writeOperations[tableName].execute();
            }
        }
    }
    /**
     * Initialises the connector by creating a first connection
     * to the db and execute a setup statement creating the initial
     * global tables.
     *
     * As a final step this checks that the postgres version is >= 9.5
     * which is the first version to support the ON CONFLICT statement
     * for UPSERTS
     */
    initialise(callback) {
        this.query(this.statements.initDb(this.options.schema), (error, result) => {
            if (error) {
                // retry for errors caused by concurrent initialisation
                // or when the DB can't be reached (e.g. it's still starting up in a Docker setup)
                if (error.code === INTERNAL_ERROR ||
                    error.code === DATABASE_IS_STARTING_UP ||
                    error.code === CONNECTION_REFUSED) {
                    this.initialise(callback);
                    return;
                }
                else {
                    callback(error);
                    return;
                }
            }
            utils_1.checkVersion(result[4].rows[0].version);
            callback(null);
        }, [], true);
    }
    /**
     * Basic check for errors. Just logs them to
     * stdout
     */
    checkError(error, client) {
        if (error && error.code !== DATABASE_IS_STARTING_UP && error.code !== CONNECTION_REFUSED) {
            this.logger.info(types_1.EVENT.ERROR, error.name);
        }
    }
}
exports.Connector = Connector;
exports.default = Connector;
//# sourceMappingURL=connector.js.map