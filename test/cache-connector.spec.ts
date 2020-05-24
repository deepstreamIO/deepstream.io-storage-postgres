// tslint:disable:no-empty no-shadowed-variable

import { Connector } from '../src/connector'
import { expect } from 'chai'
import { EventEmitter } from 'events'
import { DeepstreamServices } from '@deepstream/types'

const settings = {
  schema: '__dstest',
  user: process.env.POSTGRES_USER || 'postgres',
  database: process.env.POSTGRES_DB || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'mysecretpassword',
  host: process.env.PGHOST || 'localhost',
  port: parseInt(process.env.PGPORT!, 10) || 5432,
  useJsonb: true, // store values as searchable binary JSON (slower)
  max: 10,
  idleTimeoutMillis: 30000,
  notifications: {
    CREATE_TABLE: true,
    DESTROY_TABLE: true,
    INSERT: true,
    UPDATE: true,
    DELETE: true,
  },
}

const services = {
  logger: {
    getNameSpace: () => ({
      // tslint:disable-next-line: no-console
      info: console.log,
      // tslint:disable-next-line: no-console
      error: console.error
    })
  }
} as never as DeepstreamServices

describe('connector', () => {
  describe('the message connector has the correct structure', () => {
    let dbConnector: Connector

    it('creates the dbConnector', async () => {
      dbConnector = new Connector(settings, services)
      dbConnector.init()
      await dbConnector.whenReady()
    })

    it('destroys the connector', (done) => {
      dbConnector.destroy(done)
    })
  })

  describe('creates multiple connectors in parallel', () => {
    const connectors: Connector[] = []
    const num = 4

    it('creates four connectors', async () => {
      for (let i = 0; i < num; i++) {
        const conn = new Connector(settings, services)
        conn.init()
        connectors.push(conn)
      }
      await Promise.all(connectors.map((connector) => connector.whenReady()))
    })

    it('destroys four connectors', async () => {
      await Promise.all(connectors.map((connector) => connector.close()))
    })
  })

  describe('creates databases', () => {
    let dbConnector: Connector

    it('creates the dbConnector', async () => {
      dbConnector = new Connector(settings, services)
      dbConnector.init()
      await dbConnector.whenReady()
    })

    it('creates a schema', async () => {
      dbConnector.createSchema(settings.schema)
    })

    it('deletes a schema', async () => {
      await dbConnector.destroySchema(settings.schema)
    })

    it('destroys the connector', async () => {
      await dbConnector.close()
    })
  })

  describe('sets and gets values', () => {
    let dbConnector: Connector
    let lastMessage: any = null
    const messages: any[] = []
    const ITEM_NAME = 'some-table/some-key'

    it('creates the dbConnector', async () => {
      dbConnector = new Connector(settings, services)
      dbConnector.init()
      await dbConnector.whenReady()
    })

    it('subscribes to notifications', (done) => {
      dbConnector.subscribe((msg) => {
        messages.push(msg)
        lastMessage = msg
      }, done)
    })

    it('retrieves a non existing value', (done) => {
      dbConnector.get(ITEM_NAME, (error, version, value) => {
        expect(error).to.equal(null)
        expect(version).to.equal(-1)
        expect(value).to.equal(null)
        done()
      })
    })

    it('sets a value for a non existing table', (done) => {
      expect(lastMessage).to.equal(null)
      dbConnector.set(ITEM_NAME, 10, { firstname: 'Wolfram' }, (error) => {
        expect(error).to.equal(null)
        // give it some time to receive the notifications
        setTimeout(done, 300)
      })
    })

    it('received a notification', () => {
      expect(messages.length).to.equal(2)
      expect(messages[0]).to.deep.equal({ event: 'CREATE_TABLE', table: 'some-table' })
      expect(messages[1]).to.deep.equal({ event: 'INSERT', table: 'some-table', key: 'some-key' })
    })

    it('retrieves an existing value', (done) => {
      dbConnector.get(ITEM_NAME, (error, version, value) => {
        expect(error).to.equal(null)
        expect(version).to.equal(10)
        expect(value).to.deep.equal({ firstname: 'Wolfram' })
        done()
      })
    })

    it('sets a value for an existing table', (done) => {
      expect(messages.length).to.equal(2)
      dbConnector.set('some-table/another-key', 10, { firstname: 'Egon' }, (error) => {
        expect(error).to.equal(null)
        // give it some time to receive the notifications
        setTimeout(done, 300)
      })
    })

    it('received a notification', () => {
      expect(messages.length).to.equal(3)
      expect(messages[2]).to.deep.equal({ event: 'INSERT', table: 'some-table', key: 'another-key' })
    })

    it('deletes a value', (done) => {
      dbConnector.delete(ITEM_NAME, (error) => {
        expect(error).to.equal(null)
        // give it some time to receive the notifications
        setTimeout(done, 300)
      })
    })

    it('received a notification', () => {
      expect(messages.length).to.equal(4)
      expect(messages[3]).to.deep.equal({ event: 'DELETE', table: 'some-table', key: 'some-key' })
    })

    it("Can't retrieve a deleted value", (done) => {
      dbConnector.get(ITEM_NAME, (error, version, value) => {
        expect(error).to.equal(null)
        expect(version).to.equal(-1)
        expect(value).to.equal(null)
        done()
      })
    })

    it('destroys the connector', async () => {
      await dbConnector.close()
    })
  })

  describe('advanced sets', () => {
    let dbConnector: Connector
    let messages: any[] = []
    const ITEM_NAME = 'some-other-table/some-other-key'

    it('creates the dbConnector', async () => {
      dbConnector = new Connector(settings, services)
      dbConnector.init()
      await dbConnector.whenReady()
    })

    it('deletes the possible schema', async () => {
      await dbConnector.destroySchema(settings.schema)
    })

    it('creates the possible schema', async () => {
      await dbConnector.createSchema(settings.schema)
    })

    it('subscribes to notifications', async () => {
      await dbConnector.subscribe((msg) => {
        messages.push(msg)
      })
    })

    it('sets a value for a non existing table', () => {
      dbConnector.set(ITEM_NAME, 10, { testValue: 'A' }, (error) => {
        expect(error).to.equal(null)
      })
    })

    it('sets value B', () => {
      dbConnector.set(ITEM_NAME, 10, { testValue: 'B' }, (error) => {
        expect(error).to.equal(null)
      })
    })

    it('sets value C', () => {
      dbConnector.set(ITEM_NAME, 10, { testValue: 'C' }, (error) => {
        expect(error).to.equal(null)
      })
    })

    it('sets value D', (done) => {
      dbConnector.set(ITEM_NAME, 10, { testValue: 'D' }, (error) => {
        expect(error).to.equal(null)
        done()
      })
    })

    it('gets the latest value', (done) => {
      dbConnector.get(ITEM_NAME, (error, version, item) => {
        expect(error).to.equal(null)
        expect(item.testValue).to.equal('D')
        done()
      })
    })

    it('received the right notifications', () => {
      expect(messages.length).to.equal(2)
      expect(messages[0].event).to.equal('CREATE_TABLE')
      expect(messages[1].event).to.equal('INSERT')
      messages = []
    })

    it('writes multiple values in quick succession to an existing table', (done) => {
      dbConnector.set('some-other-table/itemA', 1, { val: 1 }, () => { })
      dbConnector.set('some-other-table/itemA', 1, { val: 2 }, () => { })
      dbConnector.set('some-other-table/itemA', 1, { val: 3 }, () => { })
      dbConnector.set('some-other-table/itemA', 1, { val: 4 }, () => { })
      dbConnector.set('some-other-table/itemA', 1, { val: 5 }, (error) => {
        expect(error).to.equal(null)
        done()
      })
    })

    it('retrieves the latest item from the last operation', (done) => {
      dbConnector.get('some-other-table/itemA', (error, version, item) => {
        expect(error).to.equal(null)
        expect(item.val).to.equal(5)
        done()
      })
    })

    it('received the right notifications', () => {
      expect(messages.length).to.equal(1)
      expect(messages[0].event).to.equal('INSERT')
      expect(messages[0].table).to.equal('some-other-table')
      expect(messages[0].key).to.equal('itemA')
      messages = []
    })

    it('writes multiple values in quick succession to a new table', (done) => {
      dbConnector.set('new-table/itemA', 1, { val: 6 }, () => { })
      dbConnector.set('new-table/itemA', 1, { val: 7 }, () => { })
      dbConnector.set('new-table/itemA', 1, { val: 8 }, () => { })
      dbConnector.set('new-table/itemA', 1, { val: 9 }, () => { })
      dbConnector.set('new-table/itemA', 1, { val: 10 }, (error) => {
        expect(error).to.equal(null)
        done()
      })
    })

    it('retrieves the latest item from the last operation', (done) => {
      dbConnector.get('new-table/itemA', (error, version, item) => {
        expect(error).to.equal(null)
        expect(item.val).to.equal(10)
        done()
      })
    })

    it('received the right notifications', () => {
      expect(messages.length).to.equal(2)
      expect(messages[0].event).to.equal('CREATE_TABLE')
      expect(messages[1].event).to.equal('INSERT')
      messages = []
    })

    it('writes a combination of values in quick succession', (done) => {
      const doneListener = new EventEmitter()

      const setgets = ['aa', 'ab', 'ba', 'bb']

      doneListener.on('set-get-done', (val) => {
        setgets.splice(setgets.indexOf(val), 1)
        if (!setgets.length) {
          done()
        }
      })

      dbConnector.set('table-a/item-a', 1, { val: 'aa' }, (error) => {
        expect(error).to.equal(null)
        dbConnector.get('table-a/item-a', (error, version, item) => {
          expect(error).to.equal(null)
          expect(item.val).to.equal('aa')
          doneListener.emit('set-get-done', 'aa')
        })
      })

      dbConnector.set('table-a/item-b', 1, { val: 'ab' }, (error) => {
        expect(error).to.equal(null)
        dbConnector.get('table-a/item-b', (error, version, item) => {
          expect(error).to.equal(null)
          expect(item.val).to.equal('ab')
          doneListener.emit('set-get-done', 'ab')
        })
      })

      dbConnector.set('table-b/item-a', 1, { val: 'ba' }, (error) => {
        expect(error).to.equal(null)
        dbConnector.get('table-b/item-a', (error, version, item) => {
          expect(error).to.equal(null)
          expect(item.val).to.equal('ba')
          doneListener.emit('set-get-done', 'ba')
        })
      })

      dbConnector.set('table-b/item-b', 1, { val: 'bb' }, (error) => {
        expect(error).to.equal(null)
        dbConnector.get('table-b/item-b', (error, version, item) => {
          expect(error).to.equal(null)
          expect(item.val).to.equal('bb')
          doneListener.emit('set-get-done', 'bb')
        })
      })
    })

    it('received the right notifications', () => {
      expect(messages.length).to.equal(6)
      let create = 0
      let update = 0
      for (let i = 0; i < messages.length; i++) {
        if (messages[i].event === 'CREATE_TABLE') { create++ }
        if (messages[i].event === 'INSERT') { update++ }
      }
      expect(create).to.equal(2)
      expect(update).to.equal(4)
    })

    it('returns the right structure for the schema', (done) => {
      dbConnector.getSchemaOverview((err, result) => {
        expect(err).to.equal(null)
        expect(result).to.deep.equal({
          'some-other-table': 2,
          'new-table': 1,
          'table-a': 2,
          'table-b': 2,
        })
        done()
      })
    })

    it('deletes a first entry from table-a', (done) => {
      messages = []
      dbConnector.delete('table-a/item-a', (err) => {
        expect(err).to.equal(null)
        setTimeout(done, 300)
      })
    })

    it('received an item delete notification', () => {
      expect(messages.length).to.equal(1)
      expect(messages[0].event).to.equal('DELETE')
      messages = []
    })

    it('returns the right structure for the schema', (done) => {
      dbConnector.getSchemaOverview((err, result) => {
        expect(err).to.equal(null)
        expect(result).to.deep.equal({
          'some-other-table': 2,
          'new-table': 1,
          'table-a': 1,
          'table-b': 2,
        })
        done()
      })
    })

    it('deletes the second entry from table-a, thus triggering table deletion', (done) => {
      messages = []
      dbConnector.delete('table-a/item-b', (err) => {
        expect(err).to.equal(null)
        setTimeout(done, 300)
      })
    })

    it('received an item delete notification', () => {
      expect(messages.length).to.equal(2)
      expect(messages[0].event).to.equal('DELETE')
      expect(messages[1].event).to.equal('DESTROY_TABLE')
      messages = []
    })

    it('returns the right structure for the schema', (done) => {
      dbConnector.getSchemaOverview((err, result) => {
        expect(err).to.equal(null)
        expect(result).to.deep.equal({
          'some-other-table': 2,
          'new-table': 1,
          'table-b': 2,
        })
        done()
      })
    })

    it('receives notifications while still subscribed', (done) => {
      messages = []
      dbConnector.set('some-other-table/x1', 1, { val: 42 }, () => { })

      setTimeout(async () => {
        expect(messages.length).to.equal(1)
        await dbConnector.unsubscribe()
        done()
      }, 300)
    })

    it("doesn't receive notifications after unsubscribing", (done) => {
      messages = []
      dbConnector.set('some-other-table/x2', 1, { val: 43 }, (err) => {
        expect(err).to.equal(null)
        expect(messages.length).to.equal(0)
        done()
      })
    })

    it('destroys the connector', async () => {
      await dbConnector.close()
    })
  })

  describe('destroys databases', () => {
    let dbConnector: Connector

    it('creates the dbConnector', async () => {
      dbConnector = new Connector(settings, services)
      dbConnector.init()
      await dbConnector.whenReady()
    })

    it('creates a database', async () => {
      await dbConnector.createSchema(settings.schema)
    })

    it('destroys a database', async () => {
      await dbConnector.destroySchema(settings.schema)
    })

    it('fails when trying to delete a non existing database', async () => {
      try {
        await dbConnector.destroySchema(settings.schema)
        throw new Error('An error should have been thrown')
      } catch (e) {
      }
    })

    it('destroys the connector', (done) => {
      dbConnector.destroy(done)
    })
  })
})
