import { expect } from 'chai'
import { parseDSKey, parsePgVersion, checkVersion } from '../src/utils'

describe('various utils work', () => {

  describe('parses keys', () => {
    it('should use predefined default table name', () => {
      expect(parseDSKey('myKey', { schema: 'bla', defaultTable: 'default' } as any))
        .to.deep.equal({
          schema: 'bla',
          table: 'default',
          id: 'myKey',
        })
    })

    it('should use custom default table name', () => {
      const config = {
        schema: 'bla',
        defaultTable: 'customDefaultName'
      } as any
      expect(parseDSKey('myKey', config))
        .to.deep.equal({
          schema: 'bla',
          table: 'customDefaultName',
          id: 'myKey',
        })
    })

    it('should detect table name without a prefix', () => {
      expect(parseDSKey('myTable/myKey', { schema: 'bla' } as any))
        .to.deep.equal({
          schema: 'bla',
          table: 'myTable',
          id: 'myKey',
        })
    })

    it('should parse multiple slashes from key', () => {
      expect(parseDSKey('abcdefmy/key/is', { schema: 'bla' } as any))
        .to.deep.equal({
          schema: 'bla',
          table: 'abcdefmy',
          id: 'key/is',
        })
    })
  })

  describe('checks version', () => {
    it('should parse all 9.5+ versions', () => {
      const pgnine = 'PostgreSQL 9.5.9 on x86_64-pc-linux-gnu, compiled by gcc (Debian 4.9.2-10) 4.9.2, 64-bit'
      const pgten = 'PostgreSQL 10.0 on x86_64-pc-linux-gnu, compiled by gcc (Debian 4.9.2-10) 4.9.2, 64-bit'
      const pgtenone = 'PostgreSQL 10.0.1 on x86_64-pc-linux-gnu, compiled by gcc (Debian 4.9.2-10) 4.9.2, 64-bit'
      expect(parsePgVersion(pgnine)).to.deep.equal([9, 5, 9])
      expect(parsePgVersion(pgten)).to.deep.equal([10, 0])
      expect(parsePgVersion(pgtenone)).to.deep.equal([10, 0, 1])
    })

    it('should throw if version is 9.5-', () => {
      const pgnine = 'PostgreSQL 9.4.1 on x86_64-pc-linux-gnu, compiled by gcc (Debian 4.9.2-10) 4.9.2, 64-bit'
      expect(() => {
        checkVersion(pgnine)
      }).to.throw(Error, 'postgres version is 9.4.1 but minimum version is 9.5')
    })

  })
})
