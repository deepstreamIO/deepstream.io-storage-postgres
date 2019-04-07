"use strict";

/* global describe, expect, it, jasmine */
const expect = require("chai").expect;
const utils = require( "../src/utils" );

describe( "various utils work", () => {

  describe( "parses keys", () => {
    it( "should use predefined default table name" , () => {
      expect( utils.parseKey( "myKey", { schema: "bla" } ) )
        .to.deep.equal({
          schema: "bla",
          table: "default",
          key: "myKey",
        });
    });

    it( "should use custom default table name" , () => {
      const config = {
        schema: "bla",
        table: {
          defaultName: "customDefaultName",
        },
      };
      expect( utils.parseKey( "myKey", config ) )
        .to.deep.equal({
          schema: "bla",
          table: "customDefaultName",
          key: "myKey",
        });
    });

    it( "should detect table name without a prefix", () => {
      expect( utils.parseKey( "myTable/myKey", { schema: "bla" } ) )
        .to.deep.equal({
          schema: "bla",
          table: "myTable",
          key: "myKey",
        });
    });

    it( "should parse multiple slashes from key", () => {
      expect( utils.parseKey( "abcdefmy/key/is", { schema: "bla" } ) )
        .to.deep.equal({
          schema: "bla",
          table: "abcdefmy",
          key: "key/is",
        });
    });

    it( "should add prefix to table", () => {
      const config = {
        schema: "bla",
        table: {
          prefix: "prefix_",
        },
      };
      expect( utils.parseKey( "abcdefmy/key", config ) )
        .to.deep.equal({
          schema: "bla",
          table: "prefix_abcdefmy",
          key: "key",
        });
    });
  });

  describe( "checks version" , () => {
    it( "should parse all 9.5+ versions" , () => {
      let pgnine = "PostgreSQL 9.5.9 on x86_64-pc-linux-gnu, compiled by gcc (Debian 4.9.2-10) 4.9.2, 64-bit";
      let pgten = "PostgreSQL 10.0 on x86_64-pc-linux-gnu, compiled by gcc (Debian 4.9.2-10) 4.9.2, 64-bit";
      let pgtenone = "PostgreSQL 10.0.1 on x86_64-pc-linux-gnu, compiled by gcc (Debian 4.9.2-10) 4.9.2, 64-bit";
      expect( utils.parsePgVersion(pgnine) ) .to.deep.equal([9, 5, 9]);
      expect( utils.parsePgVersion(pgten) ) .to.deep.equal([10, 0]);
      expect( utils.parsePgVersion(pgtenone) ) .to.deep.equal([10, 0, 1]);
    });

    it( "should throw if version is 9.5-" , () => {
      let pgnine = "PostgreSQL 9.4.1 on x86_64-pc-linux-gnu, compiled by gcc (Debian 4.9.2-10) 4.9.2, 64-bit";
      expect( () => {
        utils.checkVersion(pgnine);
      } ) .to.throw(Error, "postgres version is 9.4.1 but minimum version is 9.5");
    });

  });
});
