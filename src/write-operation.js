"use strict";

const Write = require( "./write" );

/**
 * This class represents an individual, buffered
 * batch write operation. Key-Value pairs can be added
 * until execute is called and the function is run.
 */
module.exports = class WriteOperation {

  /**
   * Creates the write operation, but doesn't
   * execute it straight away
   *
   * @param   {Object}    params         result of parsing the key
   * @param   {Connector} dbConnector PostGres DB connector instance
   *
   * @constructor
   * @returns {void}
   */
  constructor( params, dbConnector ) {
    this._params = params;
    this._dbConnector = dbConnector;
    this._writeBuffer = {};
    this._timeOut = null;
    this._callbacks = [];
    this.isEmpty = true;
  }

  /**
   * Add a Key-Value pair to the write operation.
   * Callback will be invoked once the entire batch is
   * written
   *
   * @param {String}   key      record identifier
   * @param {Object}   value    JSON value
   * @param {Function} callback Will be invoked once write is complete
   *
   * @public
   * @returns {void}
   */
  add( key, value, callback ) {
    this._writeBuffer[ key ] = value;
    this._callbacks.push( callback );
    this.isEmpty = false;
  }

  /**
   * Executes this write operation and subsequently destroys it
   *
   * @public
   * @returns {void}
   */
  execute() {
    new Write( this._params, this._writeBuffer, this._callbacks, this._dbConnector );
    this._writeBuffer = {};
    this._callbacks = [];
    this.isEmpty = true;
  }
};
