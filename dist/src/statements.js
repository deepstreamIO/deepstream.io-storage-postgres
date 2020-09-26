"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Statements {
    constructor(options) {
        this.options = options;
    }
    /**
     * Create a new schema within the database.
     */
    createSchema(params) {
        return `CREATE SCHEMA IF NOT EXISTS "${params.name}";`;
    }
    /**
     * Deletes a schema and all the tables within it
     */
    destroySchema(params) {
        return `DROP SCHEMA "${params.name}" CASCADE;`;
    }
    /**
     * Create a deepstream key/value table within
     * a schema and update its owner
     */
    createTable(params) {
        const updateOn = [];
        if (this.options.notifications.INSERT) {
            updateOn.push('INSERT');
        }
        if (this.options.notifications.UPDATE) {
            updateOn.push('UPDATE');
        }
        if (this.options.notifications.DELETE) {
            updateOn.push('DELETE');
        }
        let statement = `
      CREATE TABLE "${params.schema}"."${params.table}"
      (
          id text NOT NULL,
          version int DEFAULT 0,
          val ${this.options.useJsonb ? 'jsonb' : 'text'} NOT NULL,
          PRIMARY KEY (id)
      )
      WITH (
          OIDS = FALSE
      )
      TABLESPACE pg_default;`;
        if (params.owner) {
            statement += `
    ALTER TABLE "${params.schema}"."${params.table}"
    OWNER to "${params.owner}";
    `;
        }
        if (updateOn.length > 0) {
            statement += `
        CREATE TRIGGER "broadcast_update_${params.schema}_${params.table}"
        AFTER ${updateOn.join(' OR ')} ON "${params.schema}"."${params.table}"
        FOR EACH ROW EXECUTE PROCEDURE broadcast_update();`;
        }
        if (this.options.notifications.CREATE_TABLE) {
            statement += `NOTIFY "${params.schema}", 'CREATE_TABLE:${params.table}';`;
        }
        return statement;
    }
    /**
     * Retrieves a value from a table
     */
    get(params) {
        return `
      SELECT val, version
      FROM "${params.schema}"."${params.table}"
      WHERE id='${params.id}';`;
    }
    /**
     * Creates a bulk UPSERT statement
     */
    set(params, writeBuffer) {
        const valueStrings = [];
        for (const key in writeBuffer) {
            const { version, value } = writeBuffer[key];
            valueStrings.push(`('${key}',${version},'${JSON.stringify(value).replace(/'/g, "''")}')`);
        }
        return `
      INSERT INTO "${params.schema}"."${params.table}" (id, version, val)
      VALUES ${valueStrings.join(',')}
      ON CONFLICT (id)
      DO UPDATE SET val = EXCLUDED.val, version = EXCLUDED.version;`;
    }
    /**
     * Deletes a value from a table
     */
    delete(params) {
        return `
      DELETE FROM "${params.schema}"."${params.table}"
      WHERE id = '${params.id}';
      SELECT delete_if_empty('${params.schema}','${params.table}');`;
    }
    /**
     * Initialises the database and creates stored- and trigger-procedures
     */
    initDb(schema) {
        return `
    CREATE SCHEMA IF NOT EXISTS "${schema}";

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
        EXECUTE 'NOTIFY "' || schema || '", ''DESTROY_TABLE:' || tablename || ''';';
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

    SELECT version()
    `;
    }
    /**
     * Returns an overview of the existing tables within
     * a given schema and the
     * numbers of entries within them
     */
    getOverview(params) {
        return `
    SELECT
      table_name AS table,
      count_rows('${params.schema}', table_name) AS entries
    FROM information_schema.tables
    WHERE
      table_schema = '${params.schema}'`;
    }
}
exports.Statements = Statements;
//# sourceMappingURL=statements.js.map