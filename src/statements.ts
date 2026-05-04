import { PostgresOptions, KeyParameters } from './connector'
import { Dictionary } from 'ts-essentials'
import { JSONObject } from '@deepstream/protobuf/dist/types/all'
import { escapeIdentifier, escapeLiteral } from './utils'

export interface PgStatement {
  text: string
  values: unknown[]
}

export class Statements {
  constructor (private options: PostgresOptions) {
  }

  /**
   * Create a new schema within the database.
   */
  public createSchema (params: { name: string }): PgStatement {
    return {
      text: `CREATE SCHEMA IF NOT EXISTS ${escapeIdentifier(params.name)};`,
      values: []
    }
  }

  /**
   * Deletes a schema and all the tables within it
   */
  destroySchema (params: { name: string }): PgStatement {
    return {
      text: `DROP SCHEMA ${escapeIdentifier(params.name)} CASCADE;`,
      values: []
    }
  }

  /**
   * Create a deepstream key/value table within
   * a schema and update its owner
   */
  createTable (params: KeyParameters): PgStatement {
    const schema = escapeIdentifier(params.schema)
    const table = escapeIdentifier(params.table)
    const updateOn = []

    if (this.options.notifications.INSERT) { updateOn.push('INSERT') }
    if (this.options.notifications.UPDATE) { updateOn.push('UPDATE') }
    if (this.options.notifications.DELETE) { updateOn.push('DELETE') }

    let text = `
      CREATE TABLE ${schema}.${table}
      (
          id text NOT NULL,
          version int DEFAULT 0,
          val ${this.options.useJsonb ? 'jsonb' : 'text'} NOT NULL,
          PRIMARY KEY (id)
      )
      WITH (
          OIDS = FALSE
      )
      TABLESPACE pg_default;`

    if (params.owner) {
      text += `
    ALTER TABLE ${schema}.${table}
    OWNER to ${escapeIdentifier(params.owner)};
    `
    }

    if (updateOn.length > 0) {
      const trigger = escapeIdentifier(`broadcast_update_${params.schema}_${params.table}`)
      text += `
        CREATE TRIGGER ${trigger}
        AFTER ${updateOn.join(' OR ')} ON ${schema}.${table}
        FOR EACH ROW EXECUTE PROCEDURE broadcast_update();`
    }

    if (this.options.notifications.CREATE_TABLE) {
      text += `NOTIFY ${schema}, ${escapeLiteral(`CREATE_TABLE:${params.table}`)};`
    }

    return { text, values: [] }
  }

  /**
   * Retrieves a value from a table
   */
  public get (params: KeyParameters): PgStatement {
    return {
      text: `
      SELECT val, version
      FROM ${escapeIdentifier(params.schema)}.${escapeIdentifier(params.table)}
      WHERE id = $1;`,
      values: [params.id]
    }
  }

  /**
   * Creates a bulk UPSERT statement
   */
  set (params: KeyParameters, writeBuffer: Dictionary<{ version: number, value: JSONObject }>): PgStatement {
    const valCast = this.options.useJsonb ? '::jsonb' : '::text'
    const tuples: string[] = []
    const values: unknown[] = []

    for (const key in writeBuffer) {
      const { version, value } = writeBuffer[key]
      const i = values.length
      tuples.push(`($${i + 1}, $${i + 2}, $${i + 3}${valCast})`)
      values.push(key, version, JSON.stringify(value))
    }

    return {
      text: `
      INSERT INTO ${escapeIdentifier(params.schema)}.${escapeIdentifier(params.table)} (id, version, val)
      VALUES ${tuples.join(',')}
      ON CONFLICT (id)
      DO UPDATE SET val = EXCLUDED.val, version = EXCLUDED.version;`,
      values
    }
  }

  /**
   * Deletes a value from a table
   */
  public delete (params: KeyParameters): PgStatement {
    return {
      text: `
      DELETE FROM ${escapeIdentifier(params.schema)}.${escapeIdentifier(params.table)}
      WHERE id = $1;`,
      values: [params.id]
    }
  }

  /**
   * Drops the given table if it has no rows left. Run after a delete
   * so the cleanup sees the post-DELETE state. The function reconstructs
   * a regclass from the text args, so we pass already-quoted identifiers.
   */
  public deleteIfEmpty (params: { schema: string, table: string }): PgStatement {
    return {
      text: 'SELECT delete_if_empty($1, $2);',
      values: [escapeIdentifier(params.schema), escapeIdentifier(params.table)]
    }
  }

  /**
   * Initialises the database and creates stored- and trigger-procedures
   */
  public initDb (schema: string): PgStatement {
    return {
      text: `
    CREATE SCHEMA IF NOT EXISTS ${escapeIdentifier(schema)};

    CREATE OR REPLACE FUNCTION
    count_rows(schema text, tablename text) returns integer
    AS
    $body$
    DECLARE
      result integer;
      query varchar;
    BEGIN
      query := 'SELECT count(1) FROM "' || schema || '"."' || tablename || '"';
      execute query into result;
      return result;
    END;
    $body$
    LANGUAGE plpgsql;

   CREATE OR REPLACE FUNCTION delete_if_empty(schema text, tablename text) RETURNS VOID AS $$
    DECLARE
      t regclass;
      result integer;
    BEGIN
      t := (schema || '.' || tablename)::regclass;
      execute ( 'SELECT COUNT(*) FROM ' || t ) into result;
      IF result = 0 THEN
        EXECUTE 'DROP TABLE ' || t || ' CASCADE;';
        EXECUTE 'NOTIFY ' || schema || ', ''DESTROY_TABLE:' || tablename || ''';';
      END IF;
    END;
    $$ LANGUAGE plpgsql;

    CREATE OR REPLACE FUNCTION broadcast_update() RETURNS trigger AS $$
    DECLARE
        id text;
    BEGIN
        IF TG_OP = 'DELETE' THEN
            id = OLD.id;
          ELSE
            id = NEW.id;
          END IF;
        EXECUTE 'NOTIFY "' || TG_TABLE_SCHEMA || '", ''' || TG_OP || ':' || TG_TABLE_NAME || ':' || id || ''';';
        RETURN NULL;
     END;
     $$ LANGUAGE plpgsql;
    `,
      values: []
    }
  }

  /**
   * Returns an overview of the existing tables within
   * a given schema and the
   * numbers of entries within them
   */
  public getOverview (params: { schema: string }): PgStatement {
    return {
      text: `
    SELECT
      table_name AS table,
      count_rows($1, table_name) AS entries
    FROM information_schema.tables
    WHERE
      table_schema = $1`,
      values: [params.schema]
    }
  }
}
