import * as pg from 'pg';
import { NamespacedLogger } from '@deepstream/types';
export declare type NotificationCallback = ({ event, table, key }: {
    event: string;
    table: string;
    key: string;
}) => void;
export declare type Noop = (error: Error | null) => void;
/**
 * This class subscribes to notification events for schemas
 * triggered by NOTIFY statements.
 *
 * It creates events for CREATE_TABLE, DESTROY_TABLE, INSERT, UPDATE and DELETE
 * each containing the table name and for INSERT, UPDATE and DELETE
 * the key for the affected item
 */
export declare class SchemaListener {
    private connectionPool;
    private logger;
    private emitter;
    private releaseConnection;
    private client;
    /**
     * Creates the SchemaListener. This doesn't trigger
     * any database-interaction in itself
     */
    constructor(connectionPool: pg.Pool, logger: NamespacedLogger);
    /**
     * Subscribes to notifications for a schema.
     */
    getNotificationsForSchema(schema: string, callback: NotificationCallback, done: Noop): void;
    /**
     * Remove a subscription that was previously established using getNotificationsForSchema
     */
    unsubscribeFromNotificationsForSchema(schema: string, callback: NotificationCallback | undefined, done: Noop): void;
    /**
     * Destroys the SchemaListener by releasing its persistent connection back
     * into the pool
     */
    destroy(): void;
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
    private onNotification;
    /**
     * Retrieves a connection from the pool and keeps it open until
     * destroy is called
     */
    private connect;
    /**
     * Subscribes for notifications to a specific topic/schema
     */
    private subscribeToSchema;
}
