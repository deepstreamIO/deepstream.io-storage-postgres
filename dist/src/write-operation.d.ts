import { KeyParameters, Connector } from './connector';
import { StorageWriteCallback } from '@deepstream/types';
import { JSONObject } from '@deepstream/protobuf/dist/types/all';
export interface WriteBuffer {
    version: number;
    value: JSONObject;
}
/**
 * This class represents an individual, buffered
 * batch write operation. Key-Value pairs can be added
 * until execute is called and the function is run.
 */
export declare class WriteOperation {
    private params;
    private dbConnector;
    private writeBuffer;
    private callbacks;
    /**
     * Creates the write operation, but doesn't
     * execute it straight away
     */
    constructor(params: KeyParameters, dbConnector: Connector);
    /**
     * Add a Key-Value pair to the write operation.
     * Callback will be invoked once the entire batch is
     * written
     */
    add(key: string, version: number, value: JSONObject, callback: StorageWriteCallback): void;
    /**
     * Executes this write operation and subsequently destroys it
     */
    execute(): void;
    isEmpty(): boolean;
}
