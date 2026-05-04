import { Dictionary } from 'ts-essentials'
import { KeyParameters, Connector } from './connector'
import { StorageWriteCallback } from '@deepstream/types'
import { JSONObject } from '@deepstream/protobuf/dist/types/all'

export interface WriteBuffer { version: number, value: JSONObject }

const UNDEFINED_TABLE = '42P01'

/**
 * Buffers writes destined for a single table and flushes them in one
 * UPSERT when execute() is called. If the target table doesn't exist,
 * it is created and the write is retried once.
 */
export class WriteOperation {
  private writeBuffer: Dictionary<WriteBuffer> = {}
  private callbacks: StorageWriteCallback[] = []

  constructor (private params: KeyParameters, private dbConnector: Connector) {
  }

  /**
   * Add a Key-Value pair to the write operation.
   * Callback will be invoked once the entire batch is
   * written
   */
  public add (key: string, version: number, value: JSONObject, callback: StorageWriteCallback) {
    this.writeBuffer[key] = { version, value }
    this.callbacks.push(callback)
  }

  public isEmpty () {
    return this.callbacks.length === 0
  }

  /**
   * Captures the current buffered writes and callbacks, resets state for
   * the next batch, and runs the flush. Subsequent add() calls during the
   * round-trip accumulate into a fresh batch.
   */
  public execute () {
    const buffer = this.writeBuffer
    const callbacks = this.callbacks
    this.writeBuffer = {}
    this.callbacks = []
    this.write(buffer, callbacks, false)
  }

  /**
   * Executes the write. Composes the statement
   * and sends it to the database
   */
  private write (buffer: Dictionary<WriteBuffer>, callbacks: StorageWriteCallback[], retried: boolean) {
    const statement = this.dbConnector.statements.set(this.params, buffer)
    this.dbConnector.query(statement, (error: any) => {
      if (error && error.code === UNDEFINED_TABLE && !retried) {
        this.createTableThenRetry(buffer, callbacks)
        return
      }
      this.endAll(callbacks, error)
    }, true)
  }

  /**
   * Creates a new table and retries the write upon completion
   */
  private createTableThenRetry (buffer: Dictionary<WriteBuffer>, callbacks: StorageWriteCallback[]) {
    const owner = this.dbConnector.options.role || this.dbConnector.options.user
    const statement = this.dbConnector.statements.createTable({ ...this.params, owner })
    this.dbConnector.query(statement, (error) => {
      if (error) {
        this.endAll(callbacks, error)
        return
      }
      this.write(buffer, callbacks, true)
    })
  }

  /**
   * Invokes all callbacks and destroys the class
   */
  private endAll (callbacks: StorageWriteCallback[], error: Error | null) {
    const message = error ? error.toString() : null
    for (const callback of callbacks) {
      callback(message)
    }
  }
}
