import { PostgresOptions, KeyParameters } from './connector'

// Defense-in-depth: keep raw " and ; out of identifier names even though
// escapeIdentifier handles quote-doubling. Cosmetic for tables/ids derived from keys.
const KEY_REGEXP = /["\;]/g

/**
 * Takes a key in the format <table>/<id>
 * and splits it into its parts.
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
    id = key.slice(splitCharIndex + 1).replace(KEY_REGEXP, '')
  }
  return { schema, table, id }
}

/**
 * Postgres-safe identifier quoting: wraps in double quotes, doubles any embedded ones.
 * Use for schema, table, owner, trigger, channel names etc. that are interpolated into SQL.
 */
export const escapeIdentifier = (name: string): string => `"${name.replace(/"/g, '""')}"`

/**
 * Postgres-safe string-literal quoting (assumes standard_conforming_strings, default since 9.1).
 * Prefer parameterized $N placeholders for value-position interpolation; only use this where
 * placeholders are not allowed (e.g. NOTIFY payloads, function-internal text).
 */
export const escapeLiteral = (value: string): string => `'${value.replace(/'/g, "''")}'`

