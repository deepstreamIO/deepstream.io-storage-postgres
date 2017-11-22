'use strict'

const UNDEFINED_TABLE = '42P01'

/**
 * A single write operation to the database. Should the table
 * the write is destined for not exist this class will create
 * it and retry the operation
 */
module.exports = class Write{

  /**
   * Creates the class and immediatly invokes the first
   * write attempt
   *
   * @param   {Object}      params      params resulting from parsed key
   * @param   {Object}      writeBuffer key-value map of buffered objects
   * @param   {Array}       callbacks   an array of functions that will be invoked on completed write
   * @param   {DbConnector} dbConnector Instance of the Postgres Database connector
   *
   * @constructor
   */
  constructor( params, writeBuffer, callbacks, dbConnector ) {
    this._params = params
    if (dbConnector.options.role) {
      this._params.owner = dbConnector.options.role
    } else {
      this._params.owner = dbConnector.options.user
    }
    this._writeBuffer = writeBuffer
    this._callbacks = callbacks
    this._dbConnector = dbConnector
    this._write()
  }

  /**
   * Executes the write. Composes the statement
   * and sends it to the database
   *
   * @private
   * @returns {void}
   */
  _write() {
    const statement = this._dbConnector.statements.set( this._params, this._writeBuffer )
    this._dbConnector.query( statement, this._onWriteResult.bind( this ), null, true )
  }

  /**
   * Invoked once the first or second write attempt finishes
   *
   * @param   {Error}  error  Postgres Error or null
   * @param   {Object} result Postgres Result
   *
   * @private
   * @returns {void}
   */
  _onWriteResult( error, result ) {
    if( error && error.code === UNDEFINED_TABLE ) {
      this._createTable()
    } else if( error ) {
      this._end( error )
    } else {
      this._end( null )
    }
  }

  /**
   * Creates a new table and retries the write upon completion
   *
   * @private
   * @returns {void}
   */
  _createTable() {
    this._dbConnector.query( this._dbConnector.statements.createTable( this._params ), ( error, result ) => {
      if( error ) {
        this._end( error )
      } else {
        this._write()
      }
    })
  }

  /**
   * Invokes all callbacks and destroys the class
   *
   * @param   {Error} error
   *
   * @private
   * @returns {void}
   */
  _end( error ) {
    for( var i = 0; i < this._callbacks.length; i++ ) {
      this._callbacks[ i ]( error )
    }
    this._params = null
    this._writeBuffer = null
    this._callbacks = null
    this._dbConnector = null
  }
}