import { PostgresOptions, KeyParameters } from './connector'

// Basic RegExp to check for SQL injection. TODO Improve
const KEY_REGEXP = /[\"\;]/g

/**
 * Takes a key in the format <table>/<id>
 * and splits it into its parts. Also does some basic SQL injection checking
 */
export const parseDSKey = (key: string, options: PostgresOptions): KeyParameters => {
  const splitCharIndex = key.indexOf('/')

  const schema = options.schema

  let table
  let id
  if (splitCharIndex === -1) {
    table = options.defaultTable
    id = key.replace(KEY_REGEXP, '')
  } else {
    table = key.substring(0, splitCharIndex).replace(KEY_REGEXP, '')
    id = key.substr(splitCharIndex + 1).replace(KEY_REGEXP, '')
  }
  return { schema, table, id }
}

/**
 * Parses a postgres version string and returns it as an array, e.g.
 *
 * PostgreSQL 9.5.4 on x86_64-pc-linux-gnu, compiled by gcc (GCC) 4.8.2 20140120 (Red Hat 4.8.2-16), 64-bit
 *
 * extracts the version number : 9.5.4 and returns [9, 5, 4]
 */
export const parsePgVersion = (versionString: string) => {
  return versionString
    .match(/PostgreSQL (\d+\.*)?(\d+\.*)?(\*|\d+)/)!
    .splice(1)
    .filter((x) => typeof x !== 'undefined')
    .map((v) => parseInt(v, 10))
}

/**
 * Parses a postgres version string, e.g.
 *
 * PostgreSQL 9.5.4 on x86_64-pc-linux-gnu, compiled by gcc (GCC) 4.8.2 20140120 (Red Hat 4.8.2-16), 64-bit
 *
 * extracts the version number and throws an error if it is < 9.5 (first version to support ON CONFLICT
 * statements for UPSERTS)
 */
export const checkVersion = (versionString: string) => {
  const v = parsePgVersion(versionString)
  if ( v[ 0 ] < 9 || v[ 0 ] === 9 && v[ 1 ] < 5 ) {
    throw new Error( 'postgres version is ' + v.join('.') + ' but minimum version is 9.5')
  }
}
