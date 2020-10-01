import BPromise, { Disposer } from 'bluebird'
import { Notification, Pool, PoolClient, PoolConfig, QueryConfig, QueryResult } from 'pg'

export interface Connection extends PoolClient {
  queryAsync<T>(sql: string, values?: any[]): BPromise<QueryResult<T>>
  queryAsync<T>(queryConfig: QueryConfig): BPromise<QueryResult<T>>

  queryRowsAsync<T>(sql: string, values?: any[]): BPromise<T[]>
  queryRowsAsync<T>(queryConfig: QueryConfig): BPromise<T[]>
}

export interface Pgrm {
  pool: Pool

  getConnection(): Disposer<Connection>

  getTransaction(tablesToLock?: string[]): Disposer<Connection>

  queryAsync<T>(sql: string, values?: any[]): BPromise<T[]>
  queryAsync<T>(queryConfig: QueryConfig): BPromise<T[]>

  queryRowsAsync<T>(sql: string, value?: any[]): BPromise<T[]>
  queryRowsAsync<T>(queryConfig: QueryConfig): BPromise<T[]>

  createMultipleInsertCTE(queryConfig: QueryConfig): QueryConfig

  on(event: 'error', listener: (err: Error, client: PoolClient) => void): Pool;
  on(event: 'connect' | 'acquire' | 'remove', listener: (client: PoolClient) => void): Pool;

  end(): BPromise<void>

  withTransaction<T>(statements: (tx: Connection) => PromiseLike<T>): BPromise<T>

  withConnection<T>(statements: (connection: Connection) => PromiseLike<T>): BPromise<T>
}

export interface Config extends PoolConfig {
  dbUrl?: string
  poolSize?: number
  statementTimeout?: string
}

type CreatePgrm = (config: Config) => Pgrm
declare const createPgrm: CreatePgrm
export default createPgrm
