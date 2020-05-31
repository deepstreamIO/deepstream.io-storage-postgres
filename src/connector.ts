import * as pg from 'pg'
import * as pkg from '../package.json'
import { DeepstreamPlugin, DeepstreamStorage, NamespacedLogger, DeepstreamServices, StorageWriteCallback, StorageReadCallback, EVENT } from '@deepstream/types'
import { DeepPartial, Dictionary } from 'ts-essentials'
import { Statements } from './statements'
import { SchemaListener, Noop, NotificationCallback } from './schema-listener'
import { checkVersion, parseDSKey } from './utils'
import { StdOutLogger } from './std-out-logger'
import { WriteOperation } from './write-operation'
import { JSONObject } from '@deepstream/protobuf/dist/types/all'

export type SchemaOverviewCallback = (error: Error | null, tables?: Dictionary<number>) => void
export interface KeyParameters {
  schema: string,
  table: string,
  id: string,
  owner?: string
}

export interface PostgresOptions {
  useJsonb: any
  splitChar: string,
  defaultTable: string,
  role: string,
  user: string, // User to use for this connection
  database: string, // Database to use. Every connection is scoped to a single db
  password: string, // Password
  host: string, // AWS HOST
  port: number, // Optional postgres port
  schema: string, // Optional schema
  max: number, // Optional Maximum Parallel Connections
  idleTimeoutMillis: number // Optional Connection will be cut after this time. Might disable it later for notification
  writeInterval: number // Optional writes are buffered and flushed every [writeInterval] milliseconds
  notifications: {
    CREATE_TABLE: boolean,
    DESTROY_TABLE: boolean,
    INSERT: boolean,
    UPDATE: boolean,
    DELETE: boolean
  }
}

const PostgresOptionsDefaults: DeepPartial<PostgresOptions> = {
  splitChar: '/',
  idleTimeoutMillis: 200,
  writeInterval: 200,
  defaultTable: 'default',
  notifications: {
    CREATE_TABLE: true,
    DESTROY_TABLE: true,
    INSERT: true,
    UPDATE: true,
    DELETE: true
  }
}

const UNDEFINED_TABLE = '42P01'
const INTERNAL_ERROR = 'XX000'
const DATABASE_IS_STARTING_UP = '57P03'
const CONNECTION_REFUSED = 'ECONNREFUSED'

/**
 * Class deepstream.io postgres database connector
 */
export class Connector extends DeepstreamPlugin implements DeepstreamStorage {
  public description: string
  public options: PostgresOptions
  public statements: Statements

  private logger: NamespacedLogger
  private writeOperations: Dictionary<WriteOperation> = {}

  private connectionPool!: pg.Pool
  private schemaListener!: SchemaListener
  private flushInterval!: NodeJS.Timer
  constructor (options: DeepPartial<PostgresOptions>, private services: DeepstreamServices) {
    super()
    this.options = { ...PostgresOptionsDefaults, ...options } as PostgresOptions
    this.description = `Postgres connection to ${this.options.host} and database ${this.options.database} ${pkg.version}`
    this.statements = new Statements(this.options)

    if (this.services) {
      this.logger = this.services.logger.getNameSpace('POSTGRES')
    } else {
      const logger = new StdOutLogger()
      this.logger = logger.getNameSpace('POSTGRES')
    }
  }

  init () {
    this.connectionPool = new pg.Pool(this.options)
    this.connectionPool.on('error', this.checkError.bind(this))
    this.schemaListener = new SchemaListener(this.connectionPool, this.logger)
    this.flushInterval = setInterval(this.flushWrites.bind(this), this.options.writeInterval)
  }

  public async whenReady (): Promise<void> {
    return new Promise((resolve, reject) => this.initialise((error) => {
      if (error) {
        reject(error)
      } else {
        resolve()
      }
    }))
  }

  public async close (): Promise<void> {
    return new Promise((resolve) => this.destroy(resolve))
  }

  /**
   * Destroys the connector. Closes the connection pool and
   * all open listeners and stops the write loop
   */
  public destroy (callback: () => void) {
    clearInterval(this.flushInterval)
    this.schemaListener.destroy()
    this.connectionPool.end(callback)
  }

  /**
   * Creates a new schema.
   */
  public createSchema (name: string): Promise<void>
  public createSchema (name: string, callback?: Noop) {
    const statement = this.statements.createSchema({ name })
    if (!callback) {
      return new Promise((resolve, reject) => {
        this.query(statement, (err) => err ? reject(err) : resolve(), [], true)
      })
    }
    this.query(statement, callback, [], true)
  }

  /**
   * Destroys a previously created schema and all the tables within it
   */
  public destroySchema (name: string): Promise<void>
  public destroySchema (name: string, callback?: Noop) {
    const statement = this.statements.destroySchema({ name })
    if (!callback) {
      return new Promise((resolve, reject) => {
        this.query(statement, (err) => err ? reject(err) : resolve(), [], true)
      })
    }
    this.query(statement, callback, [], true)
  }

  /**
   * Returns a list of all the tables within a given schema
   * and the number of entries within each table
   */
  public getSchemaOverview (schema: string): Promise<Dictionary<number>>
  public getSchemaOverview (callback: SchemaOverviewCallback, schema?: string): void
  public getSchemaOverview (callbackOrName: string | SchemaOverviewCallback = this.options.schema, schema?: string): Promise<Dictionary<number>> | void {
    if (typeof callbackOrName === 'string' || callbackOrName === undefined) {
      return new Promise((resolve, reject) => {
        this.getOverview(callbackOrName ? callbackOrName : this.options.schema, (error, tables) => {
          error ? reject(error) : resolve(tables)
        })
      })
    }
    this.getOverview(schema ? schema : this.options.schema, callbackOrName)
  }

  private getOverview (schema: string, callback: SchemaOverviewCallback) {
    const statement = this.statements.getOverview({ schema })
    this.query(statement, (error, result) => {
      if (error || !result) {
        callback(error)
        return
      }
      const tables: Dictionary<number> = {}
      for (let i = 0; i < result.rows.length; i++) {
        tables[result.rows[i].table] = result.rows[i].entries
      }
      callback(null, tables)
    }, [], true)
  }

  /**
   * Subscribes to notifications for actions within a schema. Callback
   * will be invoked every time a table was created or a record was created,
   * updated or deleted
   */
  public subscribe (callback: NotificationCallback, done?: Noop, schema: string = this.options.schema) {
    if (!done) {
      return new Promise((resolve) =>
        this.schemaListener.getNotificationsForSchema(schema, callback, resolve)
      )
    }
    this.schemaListener.getNotificationsForSchema(schema, callback, done)
  }

  /**
   * Remove a subscription that was previously established using getNotificationsForSchema
   */
  public unsubscribe (callback?: NotificationCallback, done?: Noop, schema: string = this.options.schema) {
    if (!done) {
      return new Promise((resolve) =>
        this.schemaListener.unsubscribeFromNotificationsForSchema(schema, callback, resolve)
      )
    }
    this.schemaListener.unsubscribeFromNotificationsForSchema(schema, callback, done)
  }

  /**
  * This will schedule a value to be written to the database. Writes are buffered and overwrite
  * each other. At the end of this.options.writeInterval only the latest value will be written
  */
  public set (key: string, version: number, value: JSONObject, callback: StorageWriteCallback) {
    const params = parseDSKey(key, this.options)
    const tableName = params.schema + params.table

    if (!this.writeOperations[tableName]) {
      this.writeOperations[tableName] = new WriteOperation(params, this)
    }

    this.writeOperations[tableName].add(params.id, version, value, callback)
  }

  /**
  * Retrieves a value from the database
  */
  public get (key: string, callback: StorageReadCallback) {
    this.query<{ id: string, version: number, value: string }>(
      this.statements.get(parseDSKey(key, this.options)),
      (error: any, result) => {
        if (error && error.code === UNDEFINED_TABLE) {
          callback(null, -1, null)
        }
        else if (error || !result) {
          callback(error)
        }
        else if (result.rows.length === 0) {
          callback(null, -1, null)
        }
        else {
          const { version } = result.rows[0]
          let { val } = result.rows[0]
          if (typeof val === 'string') {
            val = JSON.parse(val)
          }
          callback(null, version, val)
        }
      }, [], true)
  }

  /**
  * Deletes a value from the database. If this was the last value for a given table
  * it will also delete the table itself
  */
  public delete (key: string, callback: StorageWriteCallback) {
    const statement = this.statements.delete(parseDSKey(key, this.options))
    this.query(statement, (error) => callback(error ? error.toString() : null), [], false)
  }

  public deleteBulk (recordNames: string[], callback: StorageWriteCallback): void {
    throw new Error('Method not implemented.')
  }

  /**
   * Low level interface to execute postgreSQL queries.
   */
  public query<Result> (query: string, callback: (err: Error, result?: pg.QueryResult<any>) => void, args: any[] = [], silent: boolean = false) {
    this.connectionPool.connect((error, client, done) => {
      this.checkError(error, client)
      if (error) {
        callback(error)
        return
      }
      client.query<Result>(query, args, (queryError, result) => {
        done()
        if (!silent) {
          this.checkError(queryError, client)
        }
        callback(queryError, result)
      })
    })
  }

  /**
   * Iterates through the buffered writeOperations every [writeInterval] milliseconds
   * and either executes them if they have pending writes or clears them
   * from the cache
   */
  private flushWrites () {
    for (const tableName in this.writeOperations) {
      if (this.writeOperations[tableName].isEmpty()) {
        delete this.writeOperations[tableName]
      } else {
        this.writeOperations[tableName].execute()
      }
    }
  }

  /**
   * Initialises the connector by creating a first connection
   * to the db and execute a setup statement creating the initial
   * global tables.
   *
   * As a final step this checks that the postgres version is >= 9.5
   * which is the first version to support the ON CONFLICT statement
   * for UPSERTS
   */
  public initialise (callback: Noop) {
    this.query<any>(this.statements.initDb(this.options.schema), (error: any, result) => {
      if (error) {
        // retry for errors caused by concurrent initialisation
        // or when the DB can't be reached (e.g. it's still starting up in a Docker setup)
        if (error.code === INTERNAL_ERROR ||
          error.code === DATABASE_IS_STARTING_UP ||
          error.code === CONNECTION_REFUSED) {
          this.initialise(callback)
          return
        } else {
          callback(error)
          return
        }
      }

      checkVersion((result as any)[4].rows[0].version)
      callback(null)
    }, [], true)
  }

  /**
   * Basic check for errors. Just logs them to
   * stdout
   */
  private checkError (error: any, client: pg.PoolClient) {
    if (error && error.code !== DATABASE_IS_STARTING_UP && error.code !== CONNECTION_REFUSED) {
      this.logger.info(EVENT.ERROR, error.name)
    }
  }
}

export default Connector
