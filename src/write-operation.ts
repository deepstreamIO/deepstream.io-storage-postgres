import { Write } from './write'
import { Dictionary } from 'ts-essentials'
import { KeyParameters, Connector } from './connector'
import { StorageWriteCallback } from '@deepstream/types'
import { JSONObject } from '@deepstream/protobuf/dist/types/all'

export interface WriteBuffer { version: number, value: JSONObject }

/**
 * This class represents an individual, buffered
 * batch write operation. Key-Value pairs can be added
 * until execute is called and the function is run.
 */
export class WriteOperation {
  private writeBuffer: Dictionary<WriteBuffer> = {}
  private callbacks: StorageWriteCallback[] = []

  /**
   * Creates the write operation, but doesn't
   * execute it straight away
   */
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

  /**
   * Executes this write operation and subsequently destroys it
   */
  public execute () {
    // tslint:disable-next-line: no-unused-expression
    new Write(this.params, this.writeBuffer, this.callbacks, this.dbConnector)
    this.writeBuffer = {}
    this.callbacks = []
  }

  public isEmpty () {
    return this.callbacks.length === 0
  }
}
