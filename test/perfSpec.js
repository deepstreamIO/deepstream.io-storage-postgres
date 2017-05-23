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
  idleTimeoutMillis: 30000
}


function timeWrites( dbConnector, writes, subjects, cb ) {
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
    dbConnector.set( 'perf/_' + ( i % subjects ), data, onComplete )
  }
}


describe.only( 'achieves expected writes per second', () => {
  var dbConnector

  it( 'creates the dbConnector', ( done ) => {
    dbConnector = new DbConnector( settings )
    expect( dbConnector.isReady ).to.equal( false )
    dbConnector.on( 'ready', done )
  })

  it( 'writes 1 record to ensure table exists', ( done ) => {
    timeWrites( dbConnector, 100, 10, ( err, time ) => {
      expect( err ).to.equal( null )
      done()
    })
  })

  it( 'writes 100 updates across 10 subjects', ( done ) => {
    var writes = 100
    var subjects = 100
    timeWrites( dbConnector, writes, subjects, ( err, time ) => {
      console.log( `times ${writes} writes with ${subjects} subjects at ${time.toFixed( 2 )} ms` )
      expect( err ).to.equal( null )
      setTimeout( done, 50 )
    })
  })

  it( 'writes 1000 updates across 10 subjects', ( done ) => {
    var writes = 1000
    var subjects = 1000
    timeWrites( dbConnector, writes, subjects, ( err, time ) => {
      console.log( `times ${writes} writes with ${subjects} subjects at ${time.toFixed( 2 )} ms` )
      expect( err ).to.equal( null )
      setTimeout( done, 50 )
    })
  })

  it( 'writes 10000 updates across 10 subjects', ( done ) => {
    var writes = 10000
    var subjects = 10000
    timeWrites( dbConnector, writes, subjects, ( err, time ) => {
      console.log( `times ${writes} writes with ${subjects} subjects at ${time.toFixed( 2 )} ms` )
      expect( err ).to.equal( null )
      setTimeout( done, 50 )
    })
  })

  it( 'writes 25000 updates across 10 subjects', ( done ) => {
    var writes = 25000
    var subjects = 25000
    timeWrites( dbConnector, writes, subjects, ( err, time ) => {
      console.log( `times ${writes} writes with ${subjects} subjects at ${time.toFixed( 2 )} ms` )
      expect( err ).to.equal( null )
      setTimeout( done, 50 )
    })
  })

  it( 'writes 50000 updates across 10 subjects', ( done ) => {
    var writes = 50000
    var subjects = 50000
    timeWrites( dbConnector, writes, subjects, ( err, time ) => {
      console.log( `times ${writes} writes with ${subjects} subjects at ${time.toFixed( 2 )} ms` )
      expect( err ).to.equal( null )
      setTimeout( done, 50 )
    })
  })

  it( 'writes 100000 updates across 10 subjects', ( done ) => {
    var writes = 100000
    var subjects = 100000
    timeWrites( dbConnector, writes, subjects, ( err, time ) => {
      console.log( `times ${writes} writes with ${subjects} subjects at ${time.toFixed( 2 )} ms` )
      expect( err ).to.equal( null )
      setTimeout( done, 50 )
    })
  })

  it( 'writes 250000 updates across 10 subjects', ( done ) => {
    var writes = 250000
    var subjects = 250000
    timeWrites( dbConnector, writes, subjects, ( err, time ) => {
      console.log( `times ${writes} writes with ${subjects} subjects at ${time.toFixed( 2 )} ms` )
      expect( err ).to.equal( null )
      setTimeout( done, 50 )
    })
  })

  it( 'writes 500000 updates across 10 subjects', ( done ) => {
    var writes = 500000
    var subjects = 500000
    timeWrites( dbConnector, writes, subjects, ( err, time ) => {
      console.log( `times ${writes} writes with ${subjects} subjects at ${time.toFixed( 2 )} ms` )
      expect( err ).to.equal( null )
      setTimeout( done, 50 )
    })
  })

  it( 'writes 750000 updates across 10 subjects', ( done ) => {
    var writes = 750000
    var subjects = 750000
    timeWrites( dbConnector, writes, subjects, ( err, time ) => {
      console.log( `times ${writes} writes with ${subjects} subjects at ${time.toFixed( 2 )} ms` )
      expect( err ).to.equal( null )
      setTimeout( done, 50 )
    })
  })

  it( 'writes 1000000 updates across 10 subjects', ( done ) => {
    var writes = 1000000
    var subjects = 1000000
    timeWrites( dbConnector, writes, subjects, ( err, time ) => {
      console.log( `times ${writes} writes with ${subjects} subjects at ${time.toFixed( 2 )} ms` )
      expect( err ).to.equal( null )
      setTimeout( done, 50 )
    })
  })
  it( 'destroys the connector', done => {
    dbConnector.destroy( done )
  })
})