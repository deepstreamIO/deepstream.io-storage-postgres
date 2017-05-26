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
    CREATE_TABLE: false,
    DESTROY_TABLE: false,
    INSERT: false,
    UPDATE: false,
    DELETE: false
  }
}


function timeWrites( dbConnector, writes, subjects, cb, base ) {
  base = base || 0
  const startTime = process.hrtime()
  const data = {  _d: { v: 10 }, 
    someVal: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vivamus a venenatis odio, ac pharetra lacus. Donec scelerisque aliquet odio, ac dapibus erat feugiat non. Phasellus tempor rhoncus interdum. Donec semper volutpat dolor, non pharetra diam facilisis vitae. Fusce pretium et nisl semper pretium. Vivamus maximus odio accumsan eros malesuada vehicula. Donec sed ipsum sagittis, iaculis turpis eu, elementum eros. Nullam sit amet fringilla urna. Nam eleifend interdum purus vel venenatis. Pellentesque in ipsum nisl. Morbi id dictum ex, vitae facilisis diam. Ut maximus rutrum dictum.  Sed condimentum, erat eget venenatis suscipit, quam nulla dignissim nisi, in condimentum orci diam quis lectus. Nullam iaculis pulvinar euismod. Nullam porttitor, tortor eu fermentum facilisis, urna eros cursus risus, non feugiat tellus metus in enim. Suspendisse quis mauris augue. Nullam efficitur condimentum vulputate. Ut eget feugiat odio. Cras molestie massa at lacus interdum, sed posuere tortor pharetra. Curabitur urna est, ultricies eget lectus eu.'
  }
  var completed = 0
  const onComplete = function( err ) {
    if( err !== null ) cb( err )
    completed++
    if( completed === writes ) {
        var diff = process.hrtime( startTime )
        var ms = ( diff[0] * 1e9 + diff[1] ) / 1000000;
        cb( null, ms )
    }
  }
  for( var i = 0; i < writes; i++ ) {
    data._d.v = i
    dbConnector.set( 'perf/_' + ( base + ( i % subjects ) ), data, onComplete )
  }
}

function pad( val ) {
  return val + '          '.substr(0, 10 - val.toString().length)
}

function runTests( tests, done, dbConnector, base ) {
  var i = 0
  console.log( `${pad('writes')} ${pad('subjects')} ${'time(ms)'}` )
  function next () {
    var writes = tests[ i ].writes;
    var subjects = tests[ i ].subjects;
    timeWrites( dbConnector, writes, subjects, ( err, time ) => {
      console.log( `${pad(writes)} ${pad( subjects )} ${time.toFixed( 2 )}` )
      i++
      if( i < tests.length ) {
        setTimeout( next, 50 )
      } else {
        done()
      }
    }, base )
  }
  next();
}


describe.only( 'achieves expected writes per second', () => {
  var dbConnector

  it( 'creates the dbConnector', ( done ) => {
    dbConnector = new DbConnector( settings )
    expect( dbConnector.isReady ).to.equal( false )
    dbConnector.on( 'ready', done )
  })

  it( 'deletes all existing rows', done => {
    dbConnector.query( 'DROP TABLE ds.perf', done )
  })

  it( 'writes 1 record to ensure table exists', ( done ) => {
    timeWrites( dbConnector, 100, 10, ( err, time ) => {
      expect( err ).to.equal( null )
      done()
    })
  })

  // it( 'times writes for small amounts of subjects', done => {
  //   runTests([
  //     { writes: 100,    subjects: 10 },
  //     { writes: 1000,   subjects: 10 },
  //     { writes: 5000,   subjects: 10 },
  //     { writes: 10000,  subjects: 10 },
  //     { writes: 20000,  subjects: 10 },
  //     { writes: 25000,  subjects: 10 },
  //     { writes: 50000,  subjects: 10 },
  //     { writes: 75000,  subjects: 10 },
  //     { writes: 100000,  subjects: 10 }
  //   ], done, dbConnector )
  // })


  // it( 'deletes all existing rows', done => {
  //   dbConnector.query( 'DROP TABLE ds.perf', done )
  // })

  // it( 'writes 1 record to ensure table exists', ( done ) => {
  //   timeWrites( dbConnector, 100, 10, ( err, time ) => {
  //     expect( err ).to.equal( null )
  //     done()
  //   })
  // })

  // it( 'clocks writes for incresing amounts of subjects', done => {
  //   runTests([
  //     { writes: 100,    subjects: 100 },
  //     { writes: 1000,   subjects: 1000 },
  //     { writes: 5000,   subjects: 5000  },
  //     { writes: 10000,  subjects: 10000 },
  //     { writes: 20000,  subjects: 20000 },
  //     { writes: 25000,  subjects: 25000 },
  //     { writes: 50000,  subjects: 50000 }
  //   ], done, dbConnector )
  // })

  // it( 'deletes all existing rows', done => {
  //   dbConnector.query( 'DROP TABLE ds.perf', done )
  // })

  // it( 'writes 1 record to ensure table exists', ( done ) => {
  //   timeWrites( dbConnector, 100, 10, ( err, time ) => {
  //     expect( err ).to.equal( null )
  //     done()
  //   })
  // })

  it( 'compares inserts with updates', done => {
    runTests([
      { writes: 25000,  subjects: 25000 },
      { writes: 25000,  subjects: 25000 }
    ], done, dbConnector, 100 )
  })
  

  it( 'destroys the connector', done => {
    dbConnector.destroy( done )
  })
})