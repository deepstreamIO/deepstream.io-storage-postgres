import { EventEmitter } from 'events'
import * as pg from 'pg'
import { EVENT, NamespacedLogger } from '@deepstream/types'

export type NotificationCallback = ({ event, table, key }: { event: string, table: string, key: string }) => void
export type Noop = (error: Error | null) => void

/**
 * This class subscribes to notification events for schemas
 * triggered by NOTIFY statements.
 *
 * It creates events for CREATE_TABLE, DESTROY_TABLE, INSERT, UPDATE and DELETE
 * each containing the table name and for INSERT, UPDATE and DELETE
 * the key for the affected item
 */
export class SchemaListener {
  private emitter = new EventEmitter()
  private releaseConnection!: () => void
  private client!: pg.PoolClient
  /**
   * Creates the SchemaListener. This doesn't trigger
   * any database-interaction in itself
   */
  constructor (private connectionPool: pg.Pool, private logger: NamespacedLogger) {
  }

  /**
   * Subscribes to notifications for a schema.
   */
  public getNotificationsForSchema (schema: string, callback: NotificationCallback, done: Noop) {
    const isSubscribedToSchema = this.emitter.listenerCount(schema) > 0
    this.emitter.on(schema, callback)
    if (!isSubscribedToSchema) {
      this.subscribeToSchema(schema, done)
    }
  }

  /**
   * Remove a subscription that was previously established using getNotificationsForSchema
   */
  public unsubscribeFromNotificationsForSchema (schema: string, callback: NotificationCallback | undefined, done: Noop): void {
    if (callback) {
      this.emitter.removeListener(schema, callback)
    } else {
      this.emitter.removeAllListeners(schema)
    }

    if (this.emitter.listenerCount(schema) === 0) {
      this.client.query(`UNLISTEN ${schema};`, [], done)
    }
  }

  /**
   * Destroys the SchemaListener by releasing its persistent connection back
   * into the pool
   */
  destroy () {
    if (this.releaseConnection) {
      this.releaseConnection()
    }
  }

  /**
   * Invoked for every notification received. Messages can have the
   * following structure:
   *
   * CREATE_TABLE:<table-name>
   * DESTROY_TABLE:<table-name>
   * INSERT:<table-name>:<key>
   * UPDATE:<table-name>:<key>
   * DELETE:<table-name>:<key>
   *
   * This method will split combined notifications, e.g. for bulk upserts
   * and emit them as individual events
   */
  private onNotification (msg: pg.Notification) {
    const [event, table, ...keys] = msg.payload!.split(':')
    if (keys.length === 0) {
      this.emitter.emit(msg.channel, { event, table })
    } else {
      for (const key of keys) {
        this.emitter.emit(msg.channel, { event, table, key })
      }
    }
  }

  /**
   * Retrieves a connection from the pool and keeps it open until
   * destroy is called
   */
  private connect (callback: () => void) {
    this.connectionPool.connect((error, client, done) => {
      if (error) {
        this.logger.error(EVENT.ERROR, 'Error connecting to pg pool for schema listening')
      }
      this.client = client
      this.releaseConnection = done
      this.client.on('notification', this.onNotification.bind(this))
      callback()
    })
  }

  /**
   * Subscribes for notifications to a specific topic/schema
   */
  private subscribeToSchema (schema: string, done: Noop) {
    if (this.client) {
      this.client.query(`LISTEN ${schema};`, done)
    } else {
      this.connect(this.subscribeToSchema.bind(this, schema, done))
    }
  }
}
