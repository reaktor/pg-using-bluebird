import { QueryConfig, QueryResult, Pool } from 'pg'
import BPromise, { Disposer } from 'bluebird'
import { expectType } from 'tsd'
import createPgrm, { Connection, Pgrm } from '.'

interface User {
  name: string
  age?: number
}

const pgrm = createPgrm({
  dbUrl: '',
  poolSize: 0,
  statementTimeout: '',
  connectionTimeoutMillis: 0, // A config option inherited from pg
})

expectType<Pgrm>(pgrm)

expectType<Pool>(pgrm.pool)

expectType<Disposer<Connection>>(pgrm.getConnection())

expectType<Disposer<Connection>>(pgrm.getTransaction())
expectType<Disposer<Connection>>(pgrm.getTransaction(['']))

expectType<BPromise<User[]>>(pgrm.queryAsync<User>(''))
expectType<BPromise<User[]>>(pgrm.queryAsync<User>('', []))
expectType<BPromise<User[]>>(pgrm.queryAsync({ text: '', name: '', values: [] }))

expectType<BPromise<User[]>>(pgrm.queryRowsAsync<User>(''))
expectType<BPromise<User[]>>(pgrm.queryRowsAsync<User>('', []))
expectType<BPromise<User[]>>(pgrm.queryRowsAsync({ text: '', name: '', values: [] }))

expectType<QueryConfig>(pgrm.createMultipleInsertCTE({ text: '', values: [] }))

expectType<Pool>(pgrm.on('error', (err, client) => err.stack))
expectType<Pool>(pgrm.on('connect', (client) => client.escapeLiteral('')))
expectType<Pool>(pgrm.on('acquire', (client) => client.escapeLiteral('')))
expectType<Pool>(pgrm.on('remove', (client) => client.escapeLiteral('')))

expectType<BPromise<void>>(pgrm.end())

expectType<BPromise<QueryResult<User>>>(pgrm.withConnection((conn) => conn.queryAsync<User>('')))
expectType<BPromise<QueryResult<User>>>(pgrm.withConnection((conn) => conn.queryAsync<User>('', [])))
expectType<BPromise<QueryResult<User>>>(
  pgrm.withConnection((conn) => conn.queryAsync<User>({ text: '', name: '', values: [] }))
)
expectType<BPromise<User[]>>(pgrm.withConnection((conn) => conn.queryRowsAsync<User>('')))
expectType<BPromise<User[]>>(pgrm.withConnection((conn) => conn.queryRowsAsync<User>('', [])))
expectType<BPromise<User[]>>(
  pgrm.withConnection((conn) => conn.queryRowsAsync<User>({ text: '', name: '', values: [] }))
)

expectType<BPromise<QueryResult<User>>>(pgrm.withTransaction((tx) => tx.queryAsync<User>('')))
expectType<BPromise<QueryResult<User>>>(pgrm.withTransaction((tx) => tx.queryAsync<User>('', [])))
expectType<BPromise<QueryResult<User>>>(
  pgrm.withTransaction((tx) => tx.queryAsync<User>({ text: '', name: '', values: [] }))
)

expectType<BPromise<User[]>>(pgrm.withTransaction((tx) => tx.queryRowsAsync<User>('')))
expectType<BPromise<User[]>>(pgrm.withTransaction((tx) => tx.queryRowsAsync<User>('', [])))
expectType<BPromise<User[]>>(
  pgrm.withTransaction((tx) => tx.queryRowsAsync<User>({ text: '', name: '', values: [] }))
)
