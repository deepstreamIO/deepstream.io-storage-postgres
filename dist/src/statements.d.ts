import { PostgresOptions, KeyParameters } from './connector';
import { Dictionary } from 'ts-essentials';
import { JSONObject } from '@deepstream/protobuf/dist/types/all';
export declare class Statements {
    private options;
    constructor(options: PostgresOptions);
    /**
     * Create a new schema within the database.
     */
    createSchema(params: {
        name: string;
    }): string;
    /**
     * Deletes a schema and all the tables within it
     */
    destroySchema(params: {
        name: string;
    }): string;
    /**
     * Create a deepstream key/value table within
     * a schema and update its owner
     */
    createTable(params: KeyParameters): string;
    /**
     * Retrieves a value from a table
     */
    get(params: KeyParameters): string;
    /**
     * Creates a bulk UPSERT statement
     */
    set(params: KeyParameters, writeBuffer: Dictionary<{
        version: number;
        value: JSONObject;
    }>): string;
    /**
     * Deletes a value from a table
     */
    delete(params: KeyParameters): string;
    /**
     * Initialises the database and creates stored- and trigger-procedures
     */
    initDb(schema: string): string;
    /**
     * Returns an overview of the existing tables within
     * a given schema and the
     * numbers of entries within them
     */
    getOverview(params: {
        schema: string;
    }): string;
}
