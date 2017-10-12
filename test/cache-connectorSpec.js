'use strict'

/* global describe, expect, it, jasmine */
const expect = require('chai').expect
const DbConnector = require('../src/connector')
const EventEmitter = require('events').EventEmitter

const settings = {
  user: process.env.PGUSER,
  database: process.env.PGDATABASE,
  password: process.env.PGPASSWORD,
  host: process.env.PGHOST,
  port: parseInt( process.env.PGPORT, 10 ),
  max: 10,
  idleTimeoutMillis: 30000,
  notifications: {
    CREATE_TABLE: true,
    DESTROY_TABLE: true,
    INSERT: true,
    UPDATE: false,
    DELETE: true
  }
}

describe( 'the message connector has the correct structure', () => {
  var dbConnector

  it( 'throws an error if required connection parameters are missing', () => {
    expect( () => { new DbConnector( 'gibberish' ) } ).to.throw()
  })

  it( 'creates the dbConnector', ( done ) => {
    dbConnector = new DbConnector( settings )
    expect( dbConnector.isReady ).to.equal( false )
    dbConnector.on( 'ready', done )
  })

  it( 'implements the cache/storage connector interface', () =>  {
    expect( dbConnector.name ).to.be.a( 'string' )
    expect( dbConnector.version ).to.be.a( 'string' )
    expect( dbConnector.get ).to.be.a( 'function' )
    expect( dbConnector.set ).to.be.a( 'function' )
    expect( dbConnector.delete ).to.be.a( 'function' )
    expect( dbConnector instanceof EventEmitter ).to.equal( true )
  })

  it( 'destroys the connector', done => {
    dbConnector.destroy( done )
  })
})

describe( 'creates multiple connectors in parallel', () => {
  var connectors = []

  it( 'creates four connectors', ( done ) => {
    var ready = 0, i, num = 4, conn

    for( i = 0; i < num; i++ ) {
      conn = new DbConnector( settings )
      conn.on( 'ready', () => {
        ready++
        if( ready === num ) {
          done()
        }
      })
      connectors.push( conn )
    }
  })

  it( 'destroys four connectors', ( done ) => {
    var ready = connectors.length, i

    for( i = 0; i < connectors.length; i++ ) {
      connectors[ i ].destroy(() => {
        ready--
        if( ready === 0 ) {
          done()
        }
      })
    }
  })
})

describe( 'creates databases', () => {
  var dbConnector

  it( 'creates the dbConnector', ( done ) => {
    dbConnector = new DbConnector( settings )
    expect( dbConnector.isReady ).to.equal( false )
    dbConnector.on( 'ready', done )
  })

  it( 'creates a schema', ( done ) => {
    dbConnector.createSchema( 'some-schema', ( err, result ) => {
      expect( err ).to.equal( null )
      expect( result.command ).to.equal( 'CREATE' )
      done()
    })
  })

  it( 'deletes a schema', ( done ) => {
    dbConnector.destroySchema( 'some-schema', ( err, result ) => {
      expect( err ).to.equal( null )
      expect( result.command ).to.equal( 'DROP' )
      done()
    })
  })

  it( 'destroys the connector', done => {
    dbConnector.destroy( done )
  })
})

describe( 'sets and gets values', () => {
  var dbConnector, lastMessage = null, messages = []
  const ITEM_NAME = 'some-table/some-key'

  it( 'creates the dbConnector', ( done ) => {
    dbConnector = new DbConnector( settings )
    expect( dbConnector.isReady ).to.equal( false )
    dbConnector.on( 'ready', done )
  })

  it( 'subscribes to notifications', ( done ) => {
    dbConnector.subscribe( ( msg ) => {
      messages.push( msg )
      lastMessage = msg
    }, done )
  })

  it( 'retrieves a non existing value', ( done ) => {
    dbConnector.get( ITEM_NAME, ( error, value ) => {
      expect( error ).to.equal( null )
      expect( value ).to.equal( null )
      done()
    })
  })

  it( 'sets a value for a non existing table', ( done ) => {
    expect( lastMessage ).to.be.null
    dbConnector.set( ITEM_NAME, {  _d: { v: 10 }, firstname: 'Wolfram' }, ( error ) => {
      expect( error ).to.equal( null )
      //give it some time to receive the notifications
      setTimeout( done, 300 )
    })
  })

  it( 'received a notification', () => {
    expect( messages.length ).to.equal( 2 )
    expect( messages[ 0 ] ).to.deep.equal({ event: 'CREATE_TABLE', table: 'some-table' })
    expect( messages[ 1 ] ).to.deep.equal({ event: 'INSERT', table: 'some-table', key: 'some-key' })
  })

  it( 'retrieves an existing value', ( done ) => {
    dbConnector.get( ITEM_NAME, ( error, value ) => {
      expect( error ).to.equal( null )
      expect( value ).to.deep.equal( {  _d: { v: 10 }, firstname: 'Wolfram' } )
      done()
    })
  })

  it( 'sets a value for an existing table', ( done ) => {
    expect( messages.length ).to.equal( 2 )
    dbConnector.set( 'some-table/another-key', {  _d: { v: 10 }, firstname: 'Egon' }, ( error ) => {
      expect( error ).to.equal( null )
      //give it some time to receive the notifications
      setTimeout( done, 300 )
    })
  })

  it( 'received a notification', () => {
    expect( messages.length ).to.equal( 3 )
    expect( messages[ 2 ] ).to.deep.equal({ event: 'INSERT', table: 'some-table', key: 'another-key' })
  })

  it( 'deletes a value', ( done ) => {
    dbConnector.delete( ITEM_NAME, ( error ) => {
      expect( error ).to.equal( null )
      //give it some time to receive the notifications
      setTimeout( done, 300 )
    })
  })

  it( 'received a notification', () => {
    expect( messages.length ).to.equal( 4 )
    expect( messages[ 3 ] ).to.deep.equal({ event: 'DELETE', table: 'some-table', key: 'some-key' })
  })

  it( 'Can\'t retrieve a deleted value', ( done ) => {
    dbConnector.get( ITEM_NAME, ( error, value ) => {
      expect( error ).to.equal( null )
      expect( value ).to.equal( null )
      done()
    })
  })

  it( 'destroys the connector', done => {
    dbConnector.destroy( done )
  })
})

describe( 'advanced sets', () => {
  var dbConnector, lastMessage = null, messages = []
  const ITEM_NAME = 'some-other-table/some-other-key'

  /**
   * A promisified version of dbConnector#set.
   * 
   * Written mainly for testcases that call dbConnector#set successively,
   * Written as to avoid potential race conditions.
   * 
   * #used in:
   * writes multiple values in quick succession to an existing table 
   * writes multiple values in quick succession to a new table 
   * writes a combination of values in quick succession
   * 
   * @param {String} path 
   * @param {Object} Value Object 
   * @return {Promise} Resolves an object {_done: true, _error: null}, Rejects with an error
   */
  let set = (dbConnector, path, {val}) => new Promise((fulfill, reject) => {
    dbConnector.set(path, {val}, (err) => {
      if (err) reject(err)
      fulfill({
        _done: true,
        _error: err 
      })
    })
  })

  it( 'creates the dbConnector', ( done ) => {
    dbConnector = new DbConnector( settings )
    expect( dbConnector.isReady ).to.equal( false )
    dbConnector.on( 'ready', done )
  })

  it( 'subscribes to notifications', ( done ) => {
    dbConnector.subscribe( ( msg ) => {
      messages.push( msg )
    }, done)
  })

  it( 'sets a value for a non existing table', ( done ) => {
    dbConnector.set( ITEM_NAME, {  _d: { v: 10 }, testValue: 'A' }, ( error ) => {
      expect( error ).to.equal( null )
      done()
    })
  })

  it( 'sets value B', ( done ) => {
    dbConnector.set( ITEM_NAME, {  _d: { v: 10 }, testValue: 'B' }, ( error ) => {
      expect( error ).to.equal( null )
      done()
    })
  })

  it( 'sets value C', ( done ) => {
    dbConnector.set( ITEM_NAME, {  _d: { v: 10 }, testValue: 'C' }, ( error ) => {
      expect( error ).to.equal( null )
      done()
    })
  })

  it( 'sets value D', ( done ) => {
    dbConnector.set( ITEM_NAME, {  _d: { v: 10 }, testValue: 'D' }, ( error ) => {
      expect( error ).to.equal( null )
      done()
    })
  })

  it( 'gets the latest value', ( done ) => {
    dbConnector.get( ITEM_NAME, ( error, item ) => {
      expect( error ).to.be.null
      expect( item.testValue ).to.equal( 'D' )
      done()
    })
  })

  it( 'received the right notifications', () => {
    expect( messages.length ).to.equal( 2 )
    expect( messages[ 0 ].event ).to.equal( 'CREATE_TABLE' )
    expect( messages[ 1 ].event ).to.equal( 'INSERT' )
    messages = []
  })

  it( 'writes multiple values in quick succession to an existing table', ( done ) => {
    let dbConnSet = set.bind(null, dbConnector);

    dbConnSet( 'some-table/itemA', { val: 1 })
      .then( dbConnSet.bind(null, 'some-table/itemA', { val: 2 }) )
      .then( dbConnSet.bind(null, 'some-table/itemA', { val: 3 }) )
      .then( dbConnSet.bind(null, 'some-table/itemA', { val: 4 }) )
      .then( dbConnSet.bind(null, 'some-table/itemA', { val: 5 }) )
      .then(({_done, _error}) => {
        expect(_done).to.be.true
        expect(_error).to.be.null
        done()
      })
  })

  it( 'retrieves the latest item from the last operation', ( done ) => {
    dbConnector.get( 'some-table/itemA', ( error, item ) => {
      expect( error ).to.be.null
      expect( item.val ).to.equal( 5 )
      done()
    })
  })

  it( 'received the right notifications', () => {
    expect( messages.length ).to.equal( 1 )
    expect( messages[ 0 ].event ).to.equal( 'INSERT' )
    expect( messages[ 0 ].table ).to.equal( 'some-table' )
    expect( messages[ 0 ].key ).to.equal( 'itemA' )
    messages = []
  })


  it( 'writes multiple values in quick succession to a new table', ( done ) => {
    let dbConnSet = set.bind(null, dbConnector);

    dbConnSet( 'new-table/itemA', { val: 6 })
      .then( dbConnSet.bind(null, 'new-table/itemA', { val: 7 }) )
      .then( dbConnSet.bind(null, 'new-table/itemA', { val: 8 }) )
      .then( dbConnSet.bind(null, 'new-table/itemA', { val: 9 }) )
      .then( dbConnSet.bind(null, 'new-table/itemA', { val: 10 }) )
      .then(({_done, _error}) => {
        expect(_done).to.be.true
        expect(_error).to.be.null
        done()
      })
  })

  it( 'retrieves the latest item from the last operation', ( done ) => {
    dbConnector.get( 'new-table/itemA', ( error, item ) => {
      expect( error ).to.be.null
      expect( item.val ).to.equal( 10 )
      done()
    })
  })

  it( 'received the right notifications', () => {
    expect( messages.length ).to.equal( 2 )
    expect( messages[ 0 ].event ).to.equal( 'CREATE_TABLE' )
    expect( messages[ 1 ].event ).to.equal( 'INSERT' )
    messages = []
  })

  it( 'writes a combination of values in quick succession', ( done ) => {
    let dbConnSet = set.bind(null, dbConnector);
    
    dbConnSet('table-a/item-a', { val: 'aa' })
      .then( dbConnSet.bind(null, 'table-a/item-b', { val: 'ab' }) )
      .then( dbConnSet.bind(null, 'table-b/item-a', { val: 'ba' }) )
      .then( dbConnSet.bind(null, 'table-b/item-b', { val: 'bb' }) )
      .then(({_done, _error}) => {
        expect(_done).to.be.true
        expect(_error).to.be.null
        done()
      })
  })

  it( 'retrieves item aa', ( done ) => {
    dbConnector.get( 'table-a/item-a', ( error, item ) => {
      expect( error ).to.be.null
      expect( item.val ).to.equal( 'aa' )
      done()
    })
  })

  it( 'retrieves item ab', ( done ) => {
    dbConnector.get( 'table-a/item-b', ( error, item ) => {
      expect( error ).to.be.null
      expect( item.val ).to.equal( 'ab' )
      done()
    })
  })

  it( 'retrieves item ba', ( done ) => {
    dbConnector.get( 'table-b/item-a', ( error, item ) => {
      expect( error ).to.be.null
      expect( item.val ).to.equal( 'ba' )
      done()
    })
  })

  it( 'retrieves item bb', ( done ) => {
    dbConnector.get(  'table-b/item-b', ( error, item ) => {
      expect( error ).to.be.null
      expect( item.val ).to.equal( 'bb' )
      setTimeout( done, 600 )
    })
  })

  it( 'received the right notifications', () => {
    expect( messages.length ).to.equal( 6 )
    var create = 0
    var update = 0
    for( var i = 0; i < messages.length; i++ ) {
      if( messages[ i ].event === 'CREATE_TABLE' ) create++
      if( messages[ i ].event === 'INSERT' ) update++
    }
    expect( create ).to.equal( 2 )
    expect( update ).to.equal( 4 )
  })

  it( 'returns the right structure for the schema', done => {
    dbConnector.getSchemaOverview( ( err, result ) => {
      expect( err ).to.be.null
      expect( result ).to.deep.equal({
        'some-table': 2,
        'some-other-table': 1,
        'new-table': 1,
        'table-a': 2,
        'table-b': 2
      })
      done()
    })
  })

  it( 'deletes a first entry from table-a', ( done ) => {
    messages = []
    dbConnector.delete( 'table-a/item-a', ( err ) => {
      expect( err ).to.be.null
      setTimeout( done, 300 )
    })
  })

  it( 'received an item delete notification', () => {
    expect( messages.length ).to.equal( 1 )
    expect( messages[ 0 ].event ).to.equal( 'DELETE' )
    messages = []
  })

  it( 'returns the right structure for the schema', done => {
    dbConnector.getSchemaOverview( ( err, result ) => {
      expect( err ).to.be.null
      expect( result ).to.deep.equal({
        'some-table': 2,
        'some-other-table': 1,
        'new-table': 1,
        'table-a': 1,
        'table-b': 2
      })
      done()
    })
  })

  it( 'deletes the second entry from table-a, thus triggering table deletion', ( done ) => {
    messages = []
    dbConnector.delete( 'table-a/item-b', ( err ) => {
      expect( err ).to.be.null
      setTimeout( done, 300 )
    })
  })

  it( 'received an item delete notification', () => {
    expect( messages.length ).to.equal( 2 )
    expect( messages[ 0 ].event ).to.equal( 'DELETE' )
    expect( messages[ 1 ].event ).to.equal( 'DESTROY_TABLE' )
    messages = []
  })

  it( 'returns the right structure for the schema', done => {
    dbConnector.getSchemaOverview( ( err, result ) => {
      expect( err ).to.be.null
      expect( result ).to.deep.equal({
        'some-table': 2,
        'some-other-table': 1,
        'new-table': 1,
        'table-b': 2
      })
      done()
    })
  })

  it( 'receives notifications while still subscribed', ( done ) => {
    messages = []
    dbConnector.set( 'some-table/x1', { val: 42 }, () => {})

    setTimeout(()=>{
      expect( messages.length ).to.equal( 1 )
      dbConnector.unsubscribe(( err ) => {
        expect( err ).to.be.null
        done()
      })
    }, 300 )
  })

  it( 'doesn\'t receive notifications after unsubscribing', ( done ) => {
    messages = []
    dbConnector.set( 'some-table/x2', { val: 43 }, ( err, result ) => {
      expect( err ).to.be.null
    })
    setTimeout(()=>{
      expect( messages.length ).to.equal( 0 )
      done()
    }, 300 )
  })

  it( 'destroys the connector', done => {
    dbConnector.destroy( done )
  })
})

describe( 'destroys databases', () => {
  var dbConnector

  it( 'creates the dbConnector', ( done ) => {
    dbConnector = new DbConnector( settings )
    expect( dbConnector.isReady ).to.equal( false )
    dbConnector.on( 'ready', done )
  })

  it( 'destroys a database', ( done ) => {
    dbConnector.destroySchema( 'ds', ( err, result ) => {
      expect( err ).to.equal( null )
      expect( result.command ).to.equal( 'DROP' )
      done()
    })
  })

  it( 'fails when trying to delete a non existing database', ( done ) => {
    dbConnector.destroySchema( 'ds', ( err, result ) => {
      expect( err.code ).to.equal( '3F000' ) //INVALID SCHEMA NAME
      done()
    })
  })

  it( 'destroys the connector', done => {
    dbConnector.destroy( done )
  })
})