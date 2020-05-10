import { Connector, KeyParameters } from './connector'
import { QueryResult } from 'pg'
import { Dictionary } from 'ts-essentials'
import { StorageWriteCallback } from '@deepstream/types'
import { WriteBuffer } from './write-operation'

const UNDEFINED_TABLE = '42P01'

/**
 * A single write operation to the database. Should the table
 * the write is destined for not exist this class will create
 * it and retry the operation
 */
export class Write {

  /**
   * Creates the class and immediatly invokes the first
   * write attempt
   */
  constructor (private params: KeyParameters, private writeBuffer: Dictionary<WriteBuffer>, private callbacks: StorageWriteCallback[], public dbConnector: Connector) {
    this.write()
  }

  /**
   * Executes the write. Composes the statement
   * and sends it to the database
   */
  private write () {
    const statement = this.dbConnector.statements.set(this.params, this.writeBuffer)
    this.dbConnector.query(statement, this.onWriteResult.bind(this), [], true)
  }

  /**
   * Invoked once the first or second write attempt finishes
   */
  private onWriteResult (error: any, result: QueryResult<any> | undefined) {
    if (error && error.code === UNDEFINED_TABLE) {
      this.createTable()
    } else if (error) {
      this.end(error)
    } else {
      this.end(null)
    }
  }

  /**
   * Creates a new table and retries the write upon completion
   */
  private createTable () {
    this.dbConnector.query(
      this.dbConnector.statements.createTable(
        { ...this.params, owner: this.dbConnector.options.role || this.dbConnector.options.user }),
        (error) => {
          if (error) {
            this.end(error)
          }
          this.write()
        },
        []
      )
  }

  /**
   * Invokes all callbacks and destroys the class
   */
  private end (error: Error | null) {
    for ( let i = 0; i < this.callbacks.length; i++ ) {
      this.callbacks[i](error ? error.toString() : null)
    }
  }
}
