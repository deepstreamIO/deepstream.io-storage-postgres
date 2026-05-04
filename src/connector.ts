import * as pg from 'pg'
import * as pkg from '../package.json'
import { DeepstreamPlugin, DeepstreamStorage, NamespacedLogger, DeepstreamServices, StorageWriteCallback, StorageReadCallback, EVENT } from '@deepstream/types'
import { DeepPartial, Dictionary } from 'ts-essentials'
import { Statements, PgStatement } from './statements'
import { SchemaListener, Noop, NotificationCallback } from './schema-listener'
import { parseDSKey } from './utils'
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
  schema: 'ds',
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

const INIT_MAX_ATTEMPTS = 10
const INIT_BASE_DELAY_MS = 100
const INIT_MAX_DELAY_MS = 5000

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
  private flushInterval!: NodeJS.Timeout
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
    this.connectionPool = new pg.Pool(this.poolConfig())
    this.connectionPool.on('error', this.checkError.bind(this))
    this.schemaListener = new SchemaListener(this.connectionPool, this.logger)
    this.flushInterval = setInterval(this.flushWrites.bind(this), this.options.writeInterval)
  }

  private poolConfig (): pg.PoolConfig {
    return {
      user: this.options.user,
      password: this.options.password,
      host: this.options.host,
      port: this.options.port,
      database: this.options.database,
      max: this.options.max,
      idleTimeoutMillis: this.options.idleTimeoutMillis
    }
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
      return new Promise<void>((resolve, reject) => {
        this.query(statement, (err) => err ? reject(err) : resolve(), true)
      })
    }
    this.query(statement, callback, true)
  }

  /**
   * Destroys a previously created schema and all the tables within it
   */
  public destroySchema (name: string): Promise<void>
  public destroySchema (name: string, callback?: Noop) {
    const statement = this.statements.destroySchema({ name })
    if (!callback) {
      return new Promise<void>((resolve, reject) => {
        this.query(statement, (err) => err ? reject(err) : resolve(), true)
      })
    }
    this.query(statement, callback, true)
  }

  /**
   * Returns a list of all the tables within a given schema
   * and the number of entries within each table
   */
  public getSchemaOverview (schema?: string): Promise<Dictionary<number>>
  public getSchemaOverview (callback: SchemaOverviewCallback, schema?: string): void
  public getSchemaOverview (
    arg1?: string | SchemaOverviewCallback,
    arg2?: string
  ): Promise<Dictionary<number>> | void {
    if (typeof arg1 === 'function') {
      this.getOverview(arg2 ?? this.options.schema, arg1)
      return
    }
    const target = arg1 ?? this.options.schema
    return new Promise((resolve, reject) => {
      this.getOverview(target, (error, tables) => {
        if (error || !tables) {
          reject(error ?? new Error('no tables returned'))
        } else {
          resolve(tables)
        }
      })
    })
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
    }, true)
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
    this.query<{ version: number, val: string | JSONObject }>(
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
      }, true)
  }

  /**
  * Deletes a value from the database. If this was the last value for a given table
  * it will also delete the table itself
  */
  public delete (key: string, callback: StorageWriteCallback) {
    const params = parseDSKey(key, this.options)
    this.query(this.statements.delete(params), (deleteError) => {
      if (deleteError) {
        callback(deleteError.toString())
        return
      }
      this.query(this.statements.deleteIfEmpty(params), (cleanupError) => {
        callback(cleanupError ? cleanupError.toString() : null)
      }, false)
    }, false)
  }

  public deleteBulk (_recordNames: string[], _callback: StorageWriteCallback): void {
    throw new Error('Method not implemented.')
  }

  /**
   * Low level interface to execute postgreSQL queries.
   */
  public query<Result extends pg.QueryResultRow> (statement: PgStatement, callback: (err: Error | null, result?: pg.QueryResult<Result>) => void, silent: boolean = false) {
    this.connectionPool.connect((error, client, done) => {
      this.checkError(error)
      if (error) {
        callback(error)
        return
      }
      if (client) {
        client.query<Result>(statement.text, statement.values, (queryError, result) => {
          done()
          if (!silent) {
            this.checkError(queryError)
          }
          callback(queryError, result)
        })
      } else {
        this.logger.error(EVENT.ERROR, 'pgClientUndefined')
      }
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
   * to the db and executing a setup statement creating the initial
   * global tables.
   */
  public initialise (callback: Noop) {
    this.attemptInitialise(callback, 0)
  }

  private attemptInitialise (callback: Noop, attempt: number) {
    this.query<any>(this.statements.initDb(this.options.schema), (error: any) => {
      if (error) {
        // retry for errors caused by concurrent initialisation
        // or when the DB can't be reached (e.g. it's still starting up in a Docker setup)
        const isTransient = error.code === INTERNAL_ERROR ||
          error.code === DATABASE_IS_STARTING_UP ||
          error.code === CONNECTION_REFUSED
        if (isTransient && attempt < INIT_MAX_ATTEMPTS) {
          const delay = Math.min(INIT_BASE_DELAY_MS * 2 ** attempt, INIT_MAX_DELAY_MS)
          setTimeout(() => this.attemptInitialise(callback, attempt + 1), delay)
          return
        }
        callback(error)
        return
      }
      callback(null)
    }, true)
  }

  /**
   * Basic check for errors. Just logs them to
   * stdout
   */
  private checkError (error: any) {
    if (error && error.code !== DATABASE_IS_STARTING_UP && error.code !== CONNECTION_REFUSED && error.code !== UNDEFINED_TABLE) {
      this.logger.error(EVENT.ERROR, error, { code: error.code })
    }
  }
}

export default Connector
