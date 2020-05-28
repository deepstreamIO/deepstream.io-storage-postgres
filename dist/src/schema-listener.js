"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
const types_1 = require("@deepstream/types");
/**
 * This class subscribes to notification events for schemas
 * triggered by NOTIFY statements.
 *
 * It creates events for CREATE_TABLE, DESTROY_TABLE, INSERT, UPDATE and DELETE
 * each containing the table name and for INSERT, UPDATE and DELETE
 * the key for the affected item
 */
class SchemaListener {
    /**
     * Creates the SchemaListener. This doesn't trigger
     * any database-interaction in itself
     */
    constructor(connectionPool, logger) {
        this.connectionPool = connectionPool;
        this.logger = logger;
        this.emitter = new events_1.EventEmitter();
    }
    /**
     * Subscribes to notifications for a schema.
     */
    getNotificationsForSchema(schema, callback, done) {
        const isSubscribedToSchema = this.emitter.listenerCount(schema) > 0;
        this.emitter.on(schema, callback);
        if (!isSubscribedToSchema) {
            this.subscribeToSchema(schema, done);
        }
    }
    /**
     * Remove a subscription that was previously established using getNotificationsForSchema
     */
    unsubscribeFromNotificationsForSchema(schema, callback, done) {
        if (callback) {
            this.emitter.removeListener(schema, callback);
        }
        else {
            this.emitter.removeAllListeners(schema);
        }
        if (this.emitter.listenerCount(schema) === 0) {
            this.client.query(`UNLISTEN ${schema};`, [], done);
        }
    }
    /**
     * Destroys the SchemaListener by releasing its persistent connection back
     * into the pool
     */
    destroy() {
        if (this.releaseConnection) {
            this.releaseConnection();
        }
    }
    /**
     * Invoked for every notification received. Messages can have the
     * following structure:
     *
     * CREATE_TABLE:<table-name>
     * DESTROY_TABLE:<table-name>
     * INSERT:<table-name>:<key>
     * UPDATE:<table-name>:<key>
     * DELETE:<table-name>:<key>
     *
     * This method will split combined notifications, e.g. for bulk upserts
     * and emit them as individual events
     */
    onNotification(msg) {
        const [event, table, ...keys] = msg.payload.split(':');
        if (keys.length === 0) {
            this.emitter.emit(msg.channel, { event, table });
        }
        else {
            for (const key of keys) {
                this.emitter.emit(msg.channel, { event, table, key });
            }
        }
    }
    /**
     * Retrieves a connection from the pool and keeps it open until
     * destroy is called
     */
    connect(callback) {
        this.connectionPool.connect((error, client, done) => {
            if (error) {
                this.logger.error(types_1.EVENT.ERROR, 'Error connecting to pg pool for schema listening');
            }
            this.client = client;
            this.releaseConnection = done;
            this.client.on('notification', this.onNotification.bind(this));
            callback();
        });
    }
    /**
     * Subscribes for notifications to a specific topic/schema
     */
    subscribeToSchema(schema, done) {
        if (this.client) {
            this.client.query(`LISTEN ${schema};`, done);
        }
        else {
            this.connect(this.subscribeToSchema.bind(this, schema, done));
        }
    }
}
exports.SchemaListener = SchemaListener;
//# sourceMappingURL=schema-listener.js.map