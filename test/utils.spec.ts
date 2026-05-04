import { expect } from 'chai'
import { parseDSKey } from '../src/utils'

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
})
