"use strict";

module.exports = class Statements {

  constructor( options ) {
    this._options = options;
  }

  /**
   * Create a new schema within the database.
   *
   * @param   {Object} params { name: <String> }
   *
   * @public
   * @returns {String} postgres statement
   */
  createSchema( params ) {
    this._checkParams( params, [ "name" ] );
    return `CREATE SCHEMA IF NOT EXISTS "${params.name}";`;
  }

  /**
   * Deletes a schema and all the tables within it
   *
   * @param   {Object} params { name: <String> }
   *
   * @public
   * @returns {String} postgres statement
   */
  destroySchema( params ) {
    this._checkParams( params, [ "name" ] );
    return `DROP SCHEMA "${params.name}" CASCADE;`;
  }

  /**
   * Create a deepstream key/value table within
   * a schema and update its owner
   *
   * @param   {Object} params { schema: <String>, table: <String>, owner: <String> }
   *
   * @public
   * @returns {String} postgres statement
   */
  createTable( params ) {
    this._checkParams( params, [ "schema", "table", "owner" ]);

    var updateOn = [], statement;

    if ( this._options.notifications.INSERT ) { updateOn.push( "INSERT" ); }
    if ( this._options.notifications.UPDATE ) { updateOn.push( "UPDATE" ); }
    if ( this._options.notifications.DELETE ) { updateOn.push( "DELETE" ); }

    statement = `
    CREATE TABLE "${params.schema}"."${params.table}"
    (
        id text NOT NULL,
        val ${this._options.useJsonb ? "jsonb" : "text"} NOT NULL,
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

    if ( updateOn.length > 0 ) {
      statement += `
        CREATE TRIGGER "broadcast_update_${params.schema}_${params.table}"
        AFTER ${updateOn.join( " OR " )} ON "${params.schema}"."${params.table}"
        FOR EACH ROW EXECUTE PROCEDURE broadcast_update();`;
    }

    if ( this._options.notifications.CREATE_TABLE ) {
      statement += `NOTIFY "${params.schema}", 'CREATE_TABLE:${params.table}';`;
    }

    return statement;
  }

  /**
   * Retrieves a value from a table
   *
   * @param   {Object} params { schema: <String>, table: <String>, key: <String> }
   *
   * @public
   * @returns {String} postgres statement
   */
  get( params ) {
    this._checkParams( params, [ "schema", "table", "key" ]);

    return `
      SELECT val
      FROM "${params.schema}"."${params.table}"
      WHERE id='${params.key}';`;
  }

  /**
   * Creates a bulk UPSERT statement
   *
   * @param   {Object} params { schema: <String>, table: <String> }
   * @param   {Object} writeBuffer with key = dsId, value = JSON value
   *
   * @public
   * @returns {String} postgres statement
   */
  set( params, writeBuffer ) {
    this._checkParams( params, [ "schema", "table" ]);

    var valueStrings = [], key;

    for ( key in writeBuffer ) {
      valueStrings.push(`('${key}','${JSON.stringify( writeBuffer[ key ] ).replace(/'/g, "''")}')`);
    }

    return `
      INSERT INTO "${params.schema}"."${params.table}" (id, val)
      VALUES ${valueStrings.join( "," )}
      ON CONFLICT (id)
      DO UPDATE SET val = EXCLUDED.val;`;
  }

  /**
   * Deletes a value from a table
   *
   * @param   {Object} params { schema: <String>, table: <String>, key: <String> }
   *
   * @public
   * @returns {String} postgres statement
   */
  delete( params ) {
    this._checkParams( params, [ "schema", "table", "key" ]);

    return `
      DELETE FROM "${params.schema}"."${params.table}"
      WHERE id = '${params.key}';
      SELECT delete_if_empty('${params.schema}','${params.table}');`;
  }

  /**
   * Initialises the database and creates stored- and trigger-procedures
   *
   * @public
   * @returns {String} postgres statement
   */
  initDb( schema ) {
    var statement = `
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
    return statement;
  }

  /**
   * Returns an overview of the existing tables within
   * a given schema and the
   * numbers of entries within them
   *
   * @param   {Object} params { schema: <String> }
   *
   * @public
   * @returns {String} postgres statement
   */
  getOverview( params ) {
    this._checkParams( params, [ "schema" ]);

    return `
    SELECT
      table_name AS table,
      count_rows('${params.schema}', table_name) AS entries
    FROM information_schema.tables
    WHERE
      table_schema = '${params.schema}'`;
  }

  /**
   * A quick function that makes sure that
   * all the required parameters are present
   *
   * @param   {Object} params       map of params as passed to statement
   * @param   {Array}  expectedKeys keys that need to be present within the params
   *
   * @private
   * @returns {void}
   */
  _checkParams( params, expectedKeys ) {
    for ( var i = 0; i < expectedKeys.length; i++ ) {
      if ( params[ expectedKeys[ i ] ] === undefined ) {
        console.log( expectedKeys[ i ] + " not defined" );
      }
    }
  }
};
