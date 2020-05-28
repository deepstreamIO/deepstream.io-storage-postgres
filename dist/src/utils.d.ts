import { PostgresOptions, KeyParameters } from './connector';
/**
 * Takes a key in the format <table>/<id>
 * and splits it into its parts. Also does some basic SQL injection checking
 */
export declare const parseDSKey: (key: string, options: PostgresOptions) => KeyParameters;
/**
 * Parses a postgres version string and returns it as an array, e.g.
 *
 * PostgreSQL 9.5.4 on x86_64-pc-linux-gnu, compiled by gcc (GCC) 4.8.2 20140120 (Red Hat 4.8.2-16), 64-bit
 *
 * extracts the version number : 9.5.4 and returns [9, 5, 4]
 */
export declare const parsePgVersion: (versionString: string) => number[];
/**
 * Parses a postgres version string, e.g.
 *
 * PostgreSQL 9.5.4 on x86_64-pc-linux-gnu, compiled by gcc (GCC) 4.8.2 20140120 (Red Hat 4.8.2-16), 64-bit
 *
 * extracts the version number and throws an error if it is < 9.5 (first version to support ON CONFLICT
 * statements for UPSERTS)
 */
export declare const checkVersion: (versionString: string) => void;
