'use strict'

/* global describe, expect, it, jasmine */
const expect = require('chai').expect
const utils = require( '../src/utils' )

describe( 'various utils work', () => {
	 it( 'parses keys', () => {
		expect( utils.parseKey( 'myTable/myKey', { schema: 'bla' } ) )
		.to.deep.equal({ schema: 'bla', table: 'myTable', key: 'myKey' })

		expect( utils.parseKey( 'abcdefg', { schema: 'bla' } ) )
		.to.deep.equal({ schema: 'bla', table: 'default', key: 'abcdefg' })

		expect( utils.parseKey( 'abcdefmy/key/is', { schema: 'bla' } ) )
		.to.deep.equal({ schema: 'bla', table: 'abcdefmy', key: 'key/is' })
	})
})