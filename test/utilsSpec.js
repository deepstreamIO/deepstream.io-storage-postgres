'use strict'

/* global describe, expect, it, jasmine */
const expect = require('chai').expect
const utils = require( '../src/utils' )

describe( 'various utils work', () => {

  describe( 'parses keys', () => {
    it( 'should use predefined default table name' , () => {
      expect( utils.parseKey( 'myKey', { schema: 'bla' } ) )
        .to.deep.equal({
          schema: 'bla',
          table: 'default',
          key: 'myKey'
        })
    })

    it( 'should use custom default table name' , () => {
      const config = {
        schema: 'bla',
        table: {
          defaultName: 'customDefaultName'
        }
      }
      expect( utils.parseKey( 'myKey', config ) )
        .to.deep.equal({
          schema: 'bla',
          table: 'customDefaultName',
          key: 'myKey'
        })
    })

    it( 'should detect table name without a prefix', () => {
      expect( utils.parseKey( 'myTable/myKey', { schema: 'bla' } ) )
        .to.deep.equal({
          schema: 'bla',
          table: 'myTable',
          key: 'myKey'
        })
    })

    it( 'should parse multiple slashes from key', () => {
      expect( utils.parseKey( 'abcdefmy/key/is', { schema: 'bla' } ) )
        .to.deep.equal({
          schema: 'bla',
          table: 'abcdefmy',
          key: 'key/is'
        })
    })

    it( 'should add prefix to table', () => {
      const config = {
        schema: 'bla',
        table: {
          prefix: 'prefix_'
        }
      }
      expect( utils.parseKey( 'abcdefmy/key', config ) )
        .to.deep.equal({
          schema: 'bla',
          table: 'prefix_abcdefmy',
          key: 'key'
        })
    })
  })

})
