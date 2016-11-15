'use strict'

const EventEmitter = require( 'events' ).EventEmitter

/**
 * This class subscribes to notification events for schemas
 * triggered by NOTIFY statements.
 *
 * It creates events for CREATE_TABLE, DESTROY_TABLE, INSERT, UPDATE and DELETE
 * each containing the table name and for INSERT, UPDATE and DELETE
 * the key for the affected item
 */
module.exports = class SchemaListener{

  /**
   * Creates the SchemaListener. This doesn't trigger
   * any database-interaction in itself
   *
   * @param   {pg.Pool} connectionPool The connectionpool the dbConector uses
   *
   * @constructor
   */
  constructor( connectionPool ) {
    this._connectionPool = connectionPool
    this._emitter = new EventEmitter()
    this._client = null
    this._releaseConnection = null
  }

  /**
   * Subscribes to notifications for a schema.
   *
   * @param   {String}   schema   schema name
   * @param   {Function} callback method that will be called for every relevant event
   * @param   {Function} done     method that will be called once the subscription is confirmed
   *
   * @public
   * @returns {void}
   */
  getNotificationsForSchema( schema, callback, done ) {
    const isSubscribedToSchema = this._emitter.listenerCount( schema ) > 0
    this._emitter.on( schema, callback )
    if( !isSubscribedToSchema ) {
      this._subscribeToSchema( schema, done )
    }
  }

  /**
   * Remove a subscription that was previously established using getNotificationsForSchema
   *
   * @param   {String}   schema   schema name
   * @param   {Function} callback the previously registered callback.
   *                              If none is provided all subscriptions will be removed
   * @param   {Function} done     method that will be called once the unsubscribe is confirmed
   *
   * @public
   * @returns {void}
   */
  unsubscribeFromNotificationsForSchema( schema, callback, done ) {
    if( arguments.lenght === 3 ) {
      this._emitter.removeListener( schema, callback )
    } else {
      this._emitter.removeAllListeners( schema )
      done = callback
    }

    if( this._emitter.listenerCount( schema ) === 0 ) {
      this._client.query( 'UNLISTEN ' + schema + ';', done, null, true )
    }
  }

  /**
   * Destroys the SchemaListener by releasing its persistent connection back
   * into the pool
   *
   * @public
   * @returns {void}
   */
  destroy() {
    if( this._releaseConnection ) {
      this._releaseConnection()
    }
  }

  /**
   * Invoked for every notification received. Messages can have the
   * following structure:
   *
   * CREATE_TABLE:<table-name>
   * DESTROY_TABLE:<table-name>
   * INSERT:<table-name>:<key>
   * UPDATE:<table-name>:<key>
   * DELETE:<table-name>:<key>
   *
   * This method will split combined notifications, e.g. for bulk upserts
   * and emit them as individual events
   *
   * @param   {Object} msg postgres notify object
   *
   * @private
   * @returns {void}
   */
  _onNotification( msg ) {
    var data = msg.payload.split( ':' ), i
    if( data.length === 2 ) {
      this._emitter.emit( msg.channel, {
        event: data[ 0 ],
        table: data[ 1 ]
      })
    } else {
      for( i = 2; i < data.length; i++ ) {
        this._emitter.emit( msg.channel, {
          event: data[ 0 ],
          table: data[ 1 ],
          key: data[ i ]
        })
      }
    }
  }

  /**
   * Retrieves a connection from the pool and keeps it open until
   * destroy is called
   *
   * @param   {Function} callback Will be invoked once the connection is established
   *
   * @private
   * @returns {void}
   */
  _connect( callback ) {
    this._connectionPool.connect( ( error, client, done ) => {
      if( error ) console.log( error )
      this._client = client
      this._releaseConnection = done
      this._client.on( 'notification', this._onNotification.bind( this ) )
      callback()
    })
  }

  /**
   * Subscribes for notifications to a specific topic/schema
   *
   * @param   {String}   schema   six character AppId
   * @param   {Function} done 	  invoked once subscription is confirmed
   *
   * @private
   * @returns {void}
   */
  _subscribeToSchema( schema, done ) {
    if( !this._client ) {
      this._connect( this._subscribeToSchema.bind( this, schema, done ) )
      return
    }
    this._client.query( 'LISTEN ' + schema + ';', done )
  }
}