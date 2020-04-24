"use strict";

/* global describe, expect, it, jasmine */
const expect = require("chai").expect;
const DbConnector = require("../src/connector");
const EventEmitter = require("events").EventEmitter;

const settings = {
  user: process.env.PGUSER || 'postgres',
  database: process.env.PGDATABASE || 'postgres',
  password: process.env.PGPASSWORD || 'mysecretpassword',
  host: process.env.PGHOST || 'localhost',
  port: parseInt( process.env.PGPORT, 10 ) || 5432,
  max: 10,
  idleTimeoutMillis: 30000,
  notifications: {
    CREATE_TABLE: true,
    DESTROY_TABLE: true,
    INSERT: true,
    UPDATE: false,
    DELETE: true,
  },
};

describe("connector", () => {
  describe( "the message connector has the correct structure", () => {
    var dbConnector;

    it( "creates the dbConnector", async () => {
      dbConnector = new DbConnector( settings );
      dbConnector.init()
      await dbConnector.whenReady();
    });

    it( "implements the cache/storage connector interface", () =>  {
      expect( dbConnector.get ).to.be.a( "function" );
      expect( dbConnector.set ).to.be.a( "function" );
      expect( dbConnector.delete ).to.be.a( "function" );
      expect( dbConnector instanceof EventEmitter ).to.equal( true );
    });

    it( "destroys the connector", done => {
      dbConnector.destroy( done );
    });
  });

  describe( "creates multiple connectors in parallel", () => {
    var connectors = [];

    it( "creates four connectors", ( done ) => {
      var ready = 0, i, num = 4, conn;

      for ( i = 0; i < num; i++ ) {
        conn = new DbConnector( settings );
        conn.init()
        conn.on( "ready", () => {
          ready++;
          if ( ready === num ) {
            done();
          }
        });
        connectors.push( conn );
      }
    });

    it( "destroys four connectors", ( done ) => {
      var ready = connectors.length, i;

      for ( i = 0; i < connectors.length; i++ ) {
        connectors[ i ].destroy(() => {
          ready--;
          if ( ready === 0 ) {
            done();
          }
        });
      }
    });
  });

  describe( "creates databases", () => {
    var dbConnector;

    it( "creates the dbConnector", ( done ) => {
      dbConnector = new DbConnector( settings );
      expect( dbConnector.isReady ).to.equal( false );
      dbConnector.init()
      dbConnector.on( "ready", done );
    });

    it( "creates a schema", ( done ) => {
      dbConnector.createSchema( "some-schema", ( err, result ) => {
        expect( err ).to.equal( null );
        expect( result.command ).to.equal( "CREATE" );
        done();
      });
    });

    it( "deletes a schema", ( done ) => {
      dbConnector.destroySchema( "some-schema", ( err, result ) => {
        expect( err ).to.equal( null );
        expect( result.command ).to.equal( "DROP" );
        done();
      });
    });

    it( "destroys the connector", done => {
      dbConnector.destroy( done );
    });
  });

  describe( "sets and gets values", () => {
    var dbConnector, lastMessage = null, messages = [];
    const ITEM_NAME = "some-table/some-key";

    it( "creates the dbConnector", ( done ) => {
      dbConnector = new DbConnector( settings );
      dbConnector.init()
      expect( dbConnector.isReady ).to.equal( false );
      dbConnector.on( "ready", done );
    });

    it( "subscribes to notifications", ( done ) => {
      dbConnector.subscribe( ( msg ) => {
        messages.push( msg );
        lastMessage = msg;
      }, done );
    });

    it( "retrieves a non existing value", ( done ) => {
      dbConnector.get( ITEM_NAME, ( error, version, value ) => {
        expect( error ).to.equal( null );
        expect( version ).to.equal( -1 );
        expect( value ).to.equal( null );
        done();
      });
    });

    it( "sets a value for a non existing table", ( done ) => {
      expect( lastMessage ).to.be.null;
      dbConnector.set( ITEM_NAME, 10,{ firstname: "Wolfram" }, ( error ) => {
        expect( error ).to.equal( null );
        //give it some time to receive the notifications
        setTimeout( done, 300 );
      });
    });

    it( "received a notification", () => {
      expect( messages.length ).to.equal( 2 );
      expect( messages[ 0 ] ).to.deep.equal({ event: "CREATE_TABLE", table: "some-table" });
      expect( messages[ 1 ] ).to.deep.equal({ event: "INSERT", table: "some-table", key: "some-key" });
    });

    it( "retrieves an existing value", ( done ) => {
      dbConnector.get( ITEM_NAME, ( error, version, value ) => {
        expect( error ).to.equal( null );
        expect( version ).to.equal(10);
        expect( value ).to.deep.equal( { firstname: "Wolfram" } );
        done();
      });
    });

    it( "sets a value for an existing table", ( done ) => {
      expect( messages.length ).to.equal( 2 );
      dbConnector.set( "some-table/another-key", 10 , { firstname: "Egon" }, ( error ) => {
        expect( error ).to.equal( null );
        //give it some time to receive the notifications
        setTimeout( done, 300 );
      });
    });

    it( "received a notification", () => {
      expect( messages.length ).to.equal( 3 );
      expect( messages[ 2 ] ).to.deep.equal({ event: "INSERT", table: "some-table", key: "another-key" });
    });

    it( "deletes a value", ( done ) => {
      dbConnector.delete( ITEM_NAME, ( error ) => {
        expect( error ).to.equal( null );
        //give it some time to receive the notifications
        setTimeout( done, 300 );
      });
    });

    it( "received a notification", () => {
      expect( messages.length ).to.equal( 4 );
      expect( messages[ 3 ] ).to.deep.equal({ event: "DELETE", table: "some-table", key: "some-key" });
    });

    it( "Can't retrieve a deleted value", ( done ) => {
      dbConnector.get( ITEM_NAME, ( error, version, value ) => {
        expect( error ).to.equal( null );
        expect( version ).to.equal( -1 );
        expect( value ).to.equal( null );
        done();
      });
    });

    it( "destroys the connector", done => {
      dbConnector.destroy( done );
    });
  });

  describe( "advanced sets", () => {
    var dbConnector, lastMessage = null, messages = [];
    const ITEM_NAME = "some-other-table/some-other-key";

    it( "creates the dbConnector", ( done ) => {
      dbConnector = new DbConnector( settings );
      dbConnector.init();
      expect( dbConnector.isReady ).to.equal( false );
      dbConnector.on( "ready", done );
    });

    it( "subscribes to notifications", ( done ) => {
      dbConnector.subscribe( ( msg ) => {
        messages.push( msg );
      }, done);
    });

    it( "sets a value for a non existing table", ( done ) => {
      dbConnector.set( ITEM_NAME, 10, { testValue: "A" }, ( error ) => {
        expect( error ).to.equal( null );
        done();
      });
    });

    it( "sets value B", ( done ) => {
      dbConnector.set( ITEM_NAME, 10, { testValue: "B" }, ( error ) => {
        expect( error ).to.equal( null );
        done();
      });
    });

    it( "sets value C", ( done ) => {
      dbConnector.set( ITEM_NAME, 10, { testValue: "C" }, ( error ) => {
        expect( error ).to.equal( null );
        done();
      });
    });

    it( "sets value D", ( done ) => {
      dbConnector.set( ITEM_NAME, 10, { testValue: "D" }, ( error ) => {
        expect( error ).to.equal( null );
        done();
      });
    });

    it( "gets the latest value", ( done ) => {
      dbConnector.get( ITEM_NAME, ( error, version, item ) => {
        expect( error ).to.be.null;
        expect( item.testValue ).to.equal( "D" );
        done();
      });
    });

    it( "received the right notifications", () => {
      expect( messages.length ).to.equal( 2 );
      expect( messages[ 0 ].event ).to.equal( "CREATE_TABLE" );
      expect( messages[ 1 ].event ).to.equal( "INSERT" );
      messages = [];
    });

    it( "writes multiple values in quick succession to an existing table", ( done ) => {
      dbConnector.set( "some-table/itemA", 1, { val: 1 }, () => {});
      dbConnector.set( "some-table/itemA", 1, { val: 2 }, () => {});
      dbConnector.set( "some-table/itemA", 1, { val: 3 }, () => {});
      dbConnector.set( "some-table/itemA", 1, { val: 4 }, () => {});
      dbConnector.set( "some-table/itemA", 1, { val: 5 }, ( error ) => {
        expect( error ).to.be.null;
        done();
      });
    });

    it( "retrieves the latest item from the last operation", ( done ) => {
      dbConnector.get( "some-table/itemA", ( error, version, item ) => {
        expect( error ).to.be.null;
        expect( item.val ).to.equal( 5 );
        done();
      });
    });

    it( "received the right notifications", () => {
      expect( messages.length ).to.equal( 1 );
      expect( messages[ 0 ].event ).to.equal( "INSERT" );
      expect( messages[ 0 ].table ).to.equal( "some-table" );
      expect( messages[ 0 ].key ).to.equal( "itemA" );
      messages = [];
    });

    it( "writes multiple values in quick succession to a new table", ( done ) => {
      dbConnector.set( "new-table/itemA", 1, { val: 6 }, () => {});
      dbConnector.set( "new-table/itemA", 1, { val: 7 }, () => {});
      dbConnector.set( "new-table/itemA", 1, { val: 8 }, () => {});
      dbConnector.set( "new-table/itemA", 1, { val: 9 }, () => {});
      dbConnector.set( "new-table/itemA", 1, { val: 10 }, ( error ) => {
        expect( error ).to.be.null;
        done();
      });
    });

    it( "retrieves the latest item from the last operation", ( done ) => {
      dbConnector.get( "new-table/itemA", ( error, version, item ) => {
        expect( error ).to.be.null;
        expect( item.val ).to.equal( 10 );
        done();
      });
    });

    it( "received the right notifications", () => {
      expect( messages.length ).to.equal( 2 );
      expect( messages[ 0 ].event ).to.equal( "CREATE_TABLE" );
      expect( messages[ 1 ].event ).to.equal( "INSERT" );
      messages = [];
    });

    it( "writes a combination of values in quick succession", ( done ) => {
      let doneListener = new EventEmitter();

      let setgets = [ "aa", "ab", "ba", "bb" ];

      doneListener.on("set-get-done", val => {
        setgets.splice(setgets.indexOf(val), 1);
        if (!setgets.length) {
          done();
        }
      });

      dbConnector.set( "table-a/item-a", 1, { val: "aa" }, (error) => {
        expect( error ).to.be.null;
        dbConnector.get( "table-a/item-a", ( error, version, item ) => {
          expect( error ).to.be.null;
          expect( item.val ).to.equal( "aa" );
          doneListener.emit("set-get-done", "aa");
        });
      });

      dbConnector.set( "table-a/item-b", 1, { val: "ab" }, (error) => {
        expect( error ).to.be.null;
        dbConnector.get( "table-a/item-b", ( error, version, item ) => {
          expect( error ).to.be.null;
          expect( item.val ).to.equal( "ab" );
          doneListener.emit("set-get-done", "ab");
        });
      });

      dbConnector.set( "table-b/item-a", 1, { val: "ba" }, (error) => {
        expect( error ).to.be.null;
        dbConnector.get( "table-b/item-a", ( error, version, item ) => {
          expect( error ).to.be.null;
          expect( item.val ).to.equal( "ba" );
          doneListener.emit("set-get-done", "ba");
        });
      });

      dbConnector.set( "table-b/item-b", 1, { val: "bb" }, ( error ) => {
        expect( error ).to.be.null;
        dbConnector.get(  "table-b/item-b", ( error, version, item ) => {
          expect( error ).to.be.null;
          expect( item.val ).to.equal( "bb" );
          doneListener.emit("set-get-done", "bb");
        });
      });
    });

    it( "received the right notifications", () => {
      expect( messages.length ).to.equal( 6 );
      var create = 0;
      var update = 0;
      for ( var i = 0; i < messages.length; i++ ) {
        if ( messages[ i ].event === "CREATE_TABLE" ) { create++; }
        if ( messages[ i ].event === "INSERT" ) { update++; }
      }
      expect( create ).to.equal( 2 );
      expect( update ).to.equal( 4 );
    });

    it( "returns the right structure for the schema", done => {
      dbConnector.getSchemaOverview( ( err, result ) => {
        expect( err ).to.be.null;
        expect( result ).to.deep.equal({
          "some-table": 2,
          "some-other-table": 1,
          "new-table": 1,
          "table-a": 2,
          "table-b": 2,
        });
        done();
      });
    });

    it( "deletes a first entry from table-a", ( done ) => {
      messages = [];
      dbConnector.delete( "table-a/item-a", ( err ) => {
        expect( err ).to.be.null;
        setTimeout( done, 300 );
      });
    });

    it( "received an item delete notification", () => {
      expect( messages.length ).to.equal( 1 );
      expect( messages[ 0 ].event ).to.equal( "DELETE" );
      messages = [];
    });

    it( "returns the right structure for the schema", done => {
      dbConnector.getSchemaOverview( ( err, result ) => {
        expect( err ).to.be.null;
        expect( result ).to.deep.equal({
          "some-table": 2,
          "some-other-table": 1,
          "new-table": 1,
          "table-a": 1,
          "table-b": 2,
        });
        done();
      });
    });

    it( "deletes the second entry from table-a, thus triggering table deletion", ( done ) => {
      messages = [];
      dbConnector.delete( "table-a/item-b", ( err ) => {
        expect( err ).to.be.null;
        setTimeout( done, 300 );
      });
    });

    it( "received an item delete notification", () => {
      expect( messages.length ).to.equal( 2 );
      expect( messages[ 0 ].event ).to.equal( "DELETE" );
      expect( messages[ 1 ].event ).to.equal( "DESTROY_TABLE" );
      messages = [];
    });

    it( "returns the right structure for the schema", done => {
      dbConnector.getSchemaOverview( ( err, result ) => {
        expect( err ).to.be.null;
        expect( result ).to.deep.equal({
          "some-table": 2,
          "some-other-table": 1,
          "new-table": 1,
          "table-b": 2,
        });
        done();
      });
    });

    it( "receives notifications while still subscribed", ( done ) => {
      messages = [];
      dbConnector.set( "some-table/x1", 1, { val: 42 }, () => {});

      setTimeout(() => {
        expect( messages.length ).to.equal( 1 );
        dbConnector.unsubscribe(( err ) => {
          expect( err ).to.be.null;
          done();
        });
      }, 300 );
    });

    it( "doesn't receive notifications after unsubscribing", ( done ) => {
      messages = [];
      dbConnector.set( "some-table/x2", 1, { val: 43 }, ( err, result ) => {
        expect( err ).to.be.null;
      });
      setTimeout(() => {
        expect( messages.length ).to.equal( 0 );
        done();
      }, 300 );
    });

    it( "destroys the connector", async () => {
      await dbConnector.close( );
    });
  });

  describe( "destroys databases", () => {
    var dbConnector;

    it( "creates the dbConnector", ( done ) => {
      dbConnector = new DbConnector( settings );
      dbConnector.init();
      expect( dbConnector.isReady ).to.equal( false );
      dbConnector.on( "ready", done );
    });

    it( "destroys a database", ( done ) => {
      dbConnector.destroySchema( "ds", ( err, result ) => {
        expect( err ).to.equal( null );
        expect( result.command ).to.equal( "DROP" );
        done();
      });
    });

    it( "fails when trying to delete a non existing database", ( done ) => {
      dbConnector.destroySchema( "ds", ( err, result ) => {
        expect( err.code ).to.equal( "3F000" ); //INVALID SCHEMA NAME
        done();
      });
    });

    it( "destroys the connector", done => {
      dbConnector.destroy( done );
    });
  });
});
