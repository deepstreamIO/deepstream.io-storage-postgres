import { Connector, KeyParameters } from './connector';
import { Dictionary } from 'ts-essentials';
import { StorageWriteCallback } from '@deepstream/types';
import { WriteBuffer } from './write-operation';
/**
 * A single write operation to the database. Should the table
 * the write is destined for not exist this class will create
 * it and retry the operation
 */
export declare class Write {
    private params;
    private writeBuffer;
    private callbacks;
    dbConnector: Connector;
    /**
     * Creates the class and immediatly invokes the first
     * write attempt
     */
    constructor(params: KeyParameters, writeBuffer: Dictionary<WriteBuffer>, callbacks: StorageWriteCallback[], dbConnector: Connector);
    /**
     * Executes the write. Composes the statement
     * and sends it to the database
     */
    private write;
    /**
     * Invoked once the first or second write attempt finishes
     */
    private onWriteResult;
    /**
     * Creates a new table and retries the write upon completion
     */
    private createTable;
    /**
     * Invokes all callbacks and destroys the class
     */
    private end;
}
