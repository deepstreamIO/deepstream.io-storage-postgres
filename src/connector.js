'use strict'

const UNDEFINED_TABLE = '42P01'
const INTERNAL_ERROR = 'XX000'
const DATABASE_IS_STARTING_UP = '57P03'
const CONNECTION_REFUSED = 'ECONNREFUSED'
const events = require( 'events' )
const util = require( 'util' )
const pckg = require( '../package.json' )

// native has a getter specified that will lazily load the module
// if the native module is not available it will log "Cannot find module 'pg-native'"
// could surpress this by temporarily disabling the console...
// unfortunately, multiple queries per statement fail using the native module
// disabling until resolved
const pg = /*require('pg').native ||*/ require('pg')
const Statements = require( './statements' )
const utils = require( './utils' )
const SchemaListener = require( './schema-listener' )
const WriteOperation = require( './write-operation' )

/**
 * Class deepstream.io postgres database connector
 *
 * @author deepstreamHub GmbH
 * @copyright deepstreamHub GmbH 2016
 */
module.exports = class Connector extends events.EventEmitter {

  /**
   * Creates the connector. An initial query to the database will be made to
   * establish connectivity, version compatibility and setup internal tables
   * should they not exist yet
   *
   * @param   {Object} options
   *
   * {
   *    user: 'some-user', // User to use for this connection
   *    database: 'some-database', // Database to use. Every connection is scoped to a single db
   *    password: 'some-password', // Password
   *    host: 'some-url', //AWS HOST
   *    port: 5432, //Optional postgres port
   *    schema: 'ds', //Optional schema
   *    max: 10, //Optional Maximum Parallel Connections
   *    idleTimeoutMillis: 30000 //Optional Connection will be cut after this time. Might disable it later for notification
   *    writeInterval: 200 //Optional writes are buffered and flushed every [writeInterval] milliseconds
   *    notifications: {
   *      CREATE_TABLE: true,
   *      DESTROY_TABLE: true,
   *      INSERT: true,
   *      UPDATE: false,
   *      DELETE: true
   *    }
   * }
   *
   * @constructor
   * @returns {void}
   */
  constructor( options ) {
    super()
    this.isReady = false
    this.name = pckg.name
    this.version = pckg.version
    this._structure = {}
    this.options = options
    this._checkOptions()
    this.statements = new Statements( this.options )
    this._connectionPool = new pg.Pool( this.options )
    this._connectionPool.on( 'error', this._checkError.bind( this ) )
    this._schemaListener = new SchemaListener( this._connectionPool )
    this._writeOperations = {}
    this._initialise()
    this._flushInterval = setInterval( this._flushWrites.bind( this ), this.options.writeInterval )
    this.type = `postgres connection to ${this.options.host} and database ${this.options.database}`
  }

  /**
   * Destroys the connector. Closes the connection pool and
   * all open listeners and stops the write loop
   *
   * @param   {Function} callback Callback that will be invoked once the connection pool is closed
   *
   * @public
   * @returns {void}
   */
  destroy( callback ) {
    clearInterval( this._flushInterval )
    this._schemaListener.destroy()
    this._connectionPool.end( callback )
  }

  /**
   * Creates a new schema.
   *
   * @param   {String}   name     Name of the schema
   * @param   {Function} callback Will be invoked once the schema is created
   *
   * @public
   * @returns {void}
   */
  createSchema( name, callback ) {
    var statement = this.statements.createSchema({ name: name, owner: this.options.user })
    this.query( statement, callback, null, true )
  }

  /**
   * Destroys a previously created schema and all the tables within it
   *
   * @param   {String}   name    Name of the schema
   * @param   {Function} callback Will be invoked once the schema is destroyed
   *
   * @public
   * @returns {void}
   */
  destroySchema( name, callback ) {
    var statement = this.statements.destroySchema({ name: name })
    this.query( statement, callback, null, true )
  }

  /**
   * Returns a list of all the tables within a given schema
   * and the number of entries within each table
   *
   * @param   {Function} callback Will be invoked with error and a table-to-count object
   * @param   {[String]} name     Optional name of the schema
   *
   * @public
   * @returns {void}
   */
  getSchemaOverview( callback, name ) {
    name = name || this.options.schema
    var statement = this.statements.getOverview({ schema: name })
    this.query( statement, (error, result ) => {
      if( error ) {
        callback( error )
      } else {
        var tables = {},i
        for( i = 0; i < result.rows.length; i++ ) {
          tables[ result.rows[ i ].table ] = result.rows[ i ].entries
        }
        callback( null, tables )
      }
    }, null, true )
  }

  /**
   * Subscribes to notifications for actions within a schema. Callback
   * will be invoked every time a table was created or a record was created,
   * updated or deleted
   *
   * @param   {Function} callback Will be invoked with { event: '', table: '', key: ''}
   *                              where event is one of CREATE_TABLE, DESTROY_TABLE, INSERT, UPDATE or DELETE
   * @param   {Function} done     Will be invoked as soon as the subscription is established
   * @param   {[String]} schema   Optional name of the schema
   *
   * @public
   * @returns {void}
   */
  subscribe( callback, done, schema ) {
    schema = schema || this.options.schema
    this._schemaListener.getNotificationsForSchema( schema, callback, done )
  }

  /**
   * Remove a subscription that was previously established using getNotificationsForSchema
   *
   * @param   {Function} callback the previously registered callback.
   *                              If none is provided all subscriptions will be removed
   * @param   {Function} done     method that will be called once the unsubscribe is confirmed
   * @param   {[String]} schema   Optional name of the schema
   *
   * @public
   * @returns {void}
   */
  unsubscribe( callback, done, schema ) {
    schema = schema || this.options.schema
    this._schemaListener.unsubscribeFromNotificationsForSchema( schema, callback, done )
  }

  /**
  * This will schedule a value to be written to the database. Writes are buffered and overwrite
  * each other. At the end of this.options.writeInterval only the latest value will be written
  *
  * @param {String}   key in the format <table>/<id> or <id>
  * @param {Object}   value JSON stringifyable value
  * @param {Function} callback Will be called with null or error
  *
  * @public
  * @returns {void}
  */
  set( key, value, callback ) {
    const params = utils.parseKey( key, this.options )
    const tableName = params.schema + params.table

    if( !this._writeOperations[ tableName ] ) {
      this._writeOperations[ tableName ] = new WriteOperation( params, this )
    }

    this._writeOperations[ tableName ].add( params.key, value, callback )
  }

  /**
  * Retrieves a value from the database
  *
  * @param {String}   key in the format <table>/<id> or <id>
  * @param {Function} callback Will be called with null and the stored object
  *                            for successful operations or with an error message string
  *
  * @public
  * @returns {void}
  */
  get( key, callback ) {
    this.query( this.statements.get( utils.parseKey( key, this.options ) ), ( error, result ) => {
      if( error && error.code === UNDEFINED_TABLE ) {
        callback( null, null )
      }
      else if( error ) {
        callback( error )
      }
      else if( result.rows.length === 0 ) {
        callback( null, null )
      }
      else {
        if( typeof result.rows[ 0 ].val !== 'string' ) {
          callback( null,  result.rows[ 0 ].val )
        } else {
          callback( null, JSON.parse( result.rows[ 0 ].val ) )
        }
        
      }
    }, null, true )
  }

  /**
  * Deletes a value from the database. If this was the last value for a given table
  * it will also delete the table itself
  *
  * @param   {String}   key in the format <table>/<id> or <id>
  * @param   {Function} callback Will be called with null for successful deletions or with
  *                     an error message string
  *
  * @public
  * @returns {void}
  */
  delete( key, callback ) {
    var statement = this.statements.delete( utils.parseKey( key, this.options ) )
    this.query( statement, callback )
  }

  /**
   * Low level interface to execute postgreSQL queries.
   *
   * @param   {String}      query     postgreSQL statement
   * @param   {Function}    callback  will be invoked with error and result
   * @param   {[Array]}     args      optional arguments for parameterized queries
   * @param   {[Boolean]}   silent    if true, errors won't be reported but passed on to the callback function
   *
   * @public
   * @returns {void}
   */
  query( query, callback, args, silent ) {
    this._connectionPool.connect( ( error, client, done ) => {
      this._checkError( error, 'failed to get connection from the pool' )
      if ( error ) return callback( error )
      client.query( query, args || [], ( error, result ) => {
        done()
        if( !silent ) {
          this._checkError( error, 'error during query ' +  query )
        }
        callback( error, result )
      })
    })
  }

  /**
   * Iterates through the buffered writeOperations every [writeInterval] milliseconds
   * and either executes them if they have pending writes or clears them
   * from the cache
   *
   * @private
   * @returns {void}
   */
  _flushWrites() {
    for( var tableName in this._writeOperations ) {
      if( this._writeOperations[ tableName ].isEmpty ) {
        delete this._writeOperations[ tableName ]
      } else {
        this._writeOperations[ tableName ].execute()
      }
    }
  }

  /**
   * Validates the user provided array of options.
   *
   * @param   {Object} options Connector options
   *
   * @private
   * @returns {void}
   */
  _checkOptions( options ) {
    this._checkOption( 'user', 'string' )
    //this._checkOption( 'password', 'string' )
    this._checkOption( 'host', 'string' )
    this._checkOption( 'port', 'number', 5432 )
    this._checkOption( 'max', 'number', 10 )
    this._checkOption( 'idleTimeoutMillis', 'number', 30000 )
    this._checkOption( 'writeInterval', 'number', 200 )
    this._checkOption( 'schema', 'string', 'ds' )
    this._checkOption( 'useJsonb', 'boolean', false )
    this._checkOption( 'notifications', 'object',  {
      CREATE_TABLE: false,
      DESTROY_TABLE: false,
      INSERT: false,
      UPDATE: false,
      DELETE: false
    })
  }

  /**
   * Checks an individual connector option for presence and type.
   * If a default value is specified it will be applied for missing
   * options
   *
   * @param   {String}      name          Option key
   * @param   {String}      type          A JavaScript type identifier
   * @param   {[Mixed]}     defaultValue  Optional default value
   *
   * @private
   * @returns {void}
   */
  _checkOption( name, type, defaultValue ) {
    if( this.options[ name ] === undefined && defaultValue !== undefined ) {
      this.options[ name ] = defaultValue
    }

    if( typeof this.options[ name ] !== type ) {
      throw new Error( 'missing option ' + name )
    }
  }

  /**
   * Initialises the connector by creating a first connection
   * to the db and execute a setup statement creating the initial
   * global tables.
   *
   * As a final step this checks that the postgres version is >= 9.5
   * which is the first version to support the ON CONFLICT statement
   * for UPSERTS
   *
   * @private
   * @returns {void}
   */
  _initialise() {
    this.query( this.statements.initDb( this.options.schema ), ( error, result ) => {
      if( error ) {
        // retry for errors caused by concurrent initialisation
        // or when the DB can't be reached (e.g. it's still starting up in a Docker setup)
        if( error.code === INTERNAL_ERROR ||
            error.code === DATABASE_IS_STARTING_UP ||
            error.code === CONNECTION_REFUSED ) {
          return this._initialise()
        } else {
          throw error
        }
      }
      utils.checkVersion(result[result.length - 1].rows[0].version)
      this.isReady = true
      this.emit( 'ready' )
    }, null, true )
  }

  /**
   * Basic check for errors. Just logs them to
   * stdout
   *
   * @param   {Error}   error
   * @param   {String}  message
   *
   * @private
   * @returns {void}
   */
  _checkError( error, message ) {
    if( error && error.code !== DATABASE_IS_STARTING_UP && error.code !== CONNECTION_REFUSED ) {
      console.log( error, message )
    }
  }
}
