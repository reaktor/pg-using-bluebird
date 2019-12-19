"use strict"; // eslint-disable-line semi

const pg = require('pg'),
  _ = require('lodash'),
  BPromise = require('bluebird'),
  using = BPromise.using,
  assert = require('assert')

const POOL_DEFAULTS = {
  max: 20, // pool size
  ssl: false
}

const QUERY_DEFAULTS = {
  statementTimeout: '0', // the node-postgres default is no timeout
  queryValuesKey: 'values',
  queryTextKey: 'text'
}

// Do not try to parse a postgres DATE to a javascript Date.
pg.types.setTypeParser(1082, 'text', x => x)

BPromise.promisifyAll(pg)

function getConnection(env, connector) {
  let releaseConnection

  return connector()
    .spread(function (client, done) {
      releaseConnection = done
      return client.queryAsync("SET statement_timeout TO '" + env.statementTimeout + "'")
        .then(() => decorateWithQueryRowsAsync(env, client))
    })
    .disposer(() =>
      releaseConnectionToPool(releaseConnection)
    )
}

function getTransaction(env, connector, tablesToLock=[]) {
  let releaseConnection

  return connector()
    .spread(function (client, done) {
      releaseConnection = done
      return client.queryAsync("SET statement_timeout TO '" + env.statementTimeout + "'")
        .then(() => client.queryAsync(constructLockingBeginStatement(tablesToLock)))
        .then(() => decorateWithQueryRowsAsync(env, client))
    })
    .disposer(function (tx, promise) {
      if (promise.isFulfilled()) {
        return tx.queryAsync('COMMIT').tap(() => releaseConnectionToPool(releaseConnection))
      } else {
        return tx.queryAsync('ROLLBACK').tap(() => releaseConnectionToPool(releaseConnection))
      }
    })
}

function releaseConnectionToPool(release) {
  try {
    if (release) release()
  } catch (e) { // eslint-disable-line no-empty
  }
}

function decorateWithQueryRowsAsync(env, client) {
  return Object.assign(client, {
    queryRowsAsync: (query, args) => queryWithCtxAsync(env, client, query, args).then(res => res.rows)
  })
}

function executeQueryRowsAsync(env, connector, query, args) {
  return using(getConnection(env, connector), connection =>
    connection.queryRowsAsync(query, args)
  )
}

function executeQuery(env, connector, query, args) {
  return using(getConnection(env, connector), connection =>
    connection.queryAsync(query, args)
  )
}

function queryWithCtxAsync(env, client, query, args) {
  if (_.isObject(query) && query[env.queryValuesKey] && Array.isArray(args) && args.length > 0) {
    throw new Error('Both query.values and args were passed to query. Please use only one of them.')
  }
  return client.queryAsync(query[env.queryTextKey] || query, query[env.queryValuesKey] || args)
}

function constructLockingBeginStatement(involvedTables) {
  const statements = involvedTables.map(table =>
    `LOCK TABLE ${table} IN SHARE ROW EXCLUSIVE MODE`
  )
  return ['BEGIN'].concat(statements).join(';')
}

function createMultipleInsertCTE(insert) {
  const placeholders = insert.text.match(/\$\d+/g).map(param => parseInt(param.substring(1), 10))
  assert.ok(_.isEqual(placeholders, _.range(1, placeholders.length + 1)), "Refer to the insert statement parameters in ascending order!")
  const numberOfParams = placeholders.length
  const sqlValuesText = getStringAfterLast(insert.text, 'values')
  const valuesTuples = replaceParameters(numberOfParams, sqlValuesText, insert.values)

  return {
    text: insert.text.replace(sqlValuesText, valuesTuples),
    values: insert.values
  }

  function replaceParameters(parametersInSql, sqlString, values) {
    assert.ok(values.length % parametersInSql === 0,
      `Check that there are a multiple of parameter count values in the statement, ${values.length} vs ${parametersInSql}`)
    const tupleCount = values.length / parametersInSql
    const split = sqlString.split(/\$\d+/)

    let valuesString = ''
    for (let valueTuple = 0; valueTuple < tupleCount; valueTuple++) {
      for (let tupleParamIdx = 0; tupleParamIdx < split.length - 1; tupleParamIdx++) {
        valuesString += split[tupleParamIdx] + '$' + (valueTuple * (split.length - 1) + tupleParamIdx + 1)
      }
      valuesString += split[split.length - 1] + ','
    }
    return valuesString.slice(0, -1)
  }

  function getStringAfterLast(str, searchValue) {
    const idx = str.toLowerCase().lastIndexOf(searchValue)
    return str.substring(idx + searchValue.length)
  }
}

function createPoolConfig(env) {
  const poolConfig = Object.assign({}, POOL_DEFAULTS, env)

  // backwards compatibility
  poolConfig.connectionString = env.dbUrl
  poolConfig.max = env.poolSize

  return poolConfig
}

module.exports = function (env) {
  const poolConfig = createPoolConfig(env)

  const pool = new pg.Pool(poolConfig)

  const connectMultiArgAsync = BPromise.promisify(pool.connect, { context: pool, multiArgs: true })

  const queryConfig = Object.assign({}, QUERY_DEFAULTS, env)

  return {
    pool: pool,
    getConnection: getConnectionWithEnv,
    getTransaction: getTransactionWithEnv,
    withConnection: withConnection,
    withTransaction: withTransaction,
    queryAsync: queryWithEnv,
    queryRowsAsync: queryRowsWithEnv,
    createMultipleInsertCTE,
    on,
    end
  }

  function getConnectionWithEnv() {
    return getConnection(queryConfig, connectMultiArgAsync)
  }

  function getTransactionWithEnv(tablesToLock) {
    return getTransaction(queryConfig, connectMultiArgAsync, tablesToLock)
  }

  function queryWithEnv(query, args) {
    return executeQuery(queryConfig, connectMultiArgAsync, query, args)
  }

  function queryRowsWithEnv(query, args) {
    return executeQueryRowsAsync(queryConfig, connectMultiArgAsync, query, args)
  }

  function withConnection(statements) {
    return using(getConnectionWithEnv(), statements)
  }

  function withTransaction(statements) {
    return using(getTransactionWithEnv(), statements)
  }

  function on(event, fn) { pool.on(event, fn) }

  function end() { return pool.end() }
}
