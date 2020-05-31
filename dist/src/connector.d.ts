import * as pg from 'pg';
import { DeepstreamPlugin, DeepstreamStorage, DeepstreamServices, StorageWriteCallback, StorageReadCallback } from '@deepstream/types';
import { DeepPartial, Dictionary } from 'ts-essentials';
import { Statements } from './statements';
import { Noop, NotificationCallback } from './schema-listener';
import { JSONObject } from '@deepstream/protobuf/dist/types/all';
export declare type SchemaOverviewCallback = (error: Error | null, tables?: Dictionary<number>) => void;
export interface KeyParameters {
    schema: string;
    table: string;
    id: string;
    owner?: string;
}
export interface PostgresOptions {
    useJsonb: any;
    splitChar: string;
    defaultTable: string;
    role: string;
    user: string;
    database: string;
    password: string;
    host: string;
    port: number;
    schema: string;
    max: number;
    idleTimeoutMillis: number;
    writeInterval: number;
    notifications: {
        CREATE_TABLE: boolean;
        DESTROY_TABLE: boolean;
        INSERT: boolean;
        UPDATE: boolean;
        DELETE: boolean;
    };
}
/**
 * Class deepstream.io postgres database connector
 */
export declare class Connector extends DeepstreamPlugin implements DeepstreamStorage {
    private services;
    description: string;
    options: PostgresOptions;
    statements: Statements;
    private logger;
    private writeOperations;
    private connectionPool;
    private schemaListener;
    private flushInterval;
    constructor(options: DeepPartial<PostgresOptions>, services: DeepstreamServices);
    init(): void;
    whenReady(): Promise<void>;
    close(): Promise<void>;
    /**
     * Destroys the connector. Closes the connection pool and
     * all open listeners and stops the write loop
     */
    destroy(callback: () => void): void;
    /**
     * Creates a new schema.
     */
    createSchema(name: string): Promise<void>;
    /**
     * Destroys a previously created schema and all the tables within it
     */
    destroySchema(name: string): Promise<void>;
    /**
     * Returns a list of all the tables within a given schema
     * and the number of entries within each table
     */
    getSchemaOverview(schema: string): Promise<Dictionary<number>>;
    getSchemaOverview(callback: SchemaOverviewCallback, schema?: string): void;
    private getOverview;
    /**
     * Subscribes to notifications for actions within a schema. Callback
     * will be invoked every time a table was created or a record was created,
     * updated or deleted
     */
    subscribe(callback: NotificationCallback, done?: Noop, schema?: string): Promise<unknown> | undefined;
    /**
     * Remove a subscription that was previously established using getNotificationsForSchema
     */
    unsubscribe(callback?: NotificationCallback, done?: Noop, schema?: string): Promise<unknown> | undefined;
    /**
    * This will schedule a value to be written to the database. Writes are buffered and overwrite
    * each other. At the end of this.options.writeInterval only the latest value will be written
    */
    set(key: string, version: number, value: JSONObject, callback: StorageWriteCallback): void;
    /**
    * Retrieves a value from the database
    */
    get(key: string, callback: StorageReadCallback): void;
    /**
    * Deletes a value from the database. If this was the last value for a given table
    * it will also delete the table itself
    */
    delete(key: string, callback: StorageWriteCallback): void;
    deleteBulk(recordNames: string[], callback: StorageWriteCallback): void;
    /**
     * Low level interface to execute postgreSQL queries.
     */
    query<Result>(query: string, callback: (err: Error, result?: pg.QueryResult<any>) => void, args?: any[], silent?: boolean): void;
    /**
     * Iterates through the buffered writeOperations every [writeInterval] milliseconds
     * and either executes them if they have pending writes or clears them
     * from the cache
     */
    private flushWrites;
    /**
     * Initialises the connector by creating a first connection
     * to the db and execute a setup statement creating the initial
     * global tables.
     *
     * As a final step this checks that the postgres version is >= 9.5
     * which is the first version to support the ON CONFLICT statement
     * for UPSERTS
     */
    initialise(callback: Noop): void;
    /**
     * Basic check for errors. Just logs them to
     * stdout
     */
    private checkError;
}
export default Connector;
