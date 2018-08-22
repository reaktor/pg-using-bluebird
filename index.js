"use strict"; // eslint-disable-line semi

var pg = require('pg'),
  _ = require('lodash'),
  BPromise = require('bluebird'),
  stringTemplate = require('string-template'),
  using = BPromise.using,
  assert = require('assert')

var POOL_DEFAULTS = {
  max: 20, // pool size
  ssl: false
}

var QUERY_DEFAULTS = {
  statementTimeout: '0', // the node-postgres default is no timeout
  queryValuesKey: 'values',
  queryTextKey: 'text'
}

// Do not try to parse a postgres DATE to a javascript Date.
pg.types.setTypeParser(1082, 'text', _.identity)

BPromise.promisifyAll(pg)

function getConnection(env, connector) {
  var releaseConnection

  return connector()
    .spread(function (client, done) {
      releaseConnection = done
      return client.queryAsync("SET statement_timeout TO '" + env.statementTimeout + "'")
        .then(function () { return decorateWithQueryRowsAsync(env, client) })
    })
    .disposer(function () {
      releaseConnectionToPool(releaseConnection)
    })
}

function getTransaction(env, connector, tablesToLock_) {
  var tablesToLock = tablesToLock_ || []
  var releaseConnection

  return connector()
    .spread(function (client, done) {
      releaseConnection = done
      return client.queryAsync("SET statement_timeout TO '" + env.statementTimeout + "'")
        .then(function () { return client.queryAsync(constructLockingBeginStatement(tablesToLock)) })
        .then(function () { return decorateWithQueryRowsAsync(env, client) })
    })
    .disposer(function (tx, promise) {
      if (promise.isFulfilled()) {
        return tx.queryAsync('COMMIT').tap(function () { return releaseConnectionToPool(releaseConnection) })
      } else {
        return tx.queryAsync('ROLLBACK').tap(function () { return releaseConnectionToPool(releaseConnection) })
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
    queryRowsAsync: (query, args) => queryWithCtxAsync(env, client, query, args).then(getRows)
  })
}

function executeQueryRowsAsync(env, connector, query, args) {
  return using(getConnection(env, connector), function (connection) {
    return connection.queryRowsAsync(query, args)
  })
}

function getRows(res) {
  return res.rows
}

function queryWithCtxAsync(env, client, query, args) {
  if (_.isObject(query) && query[env.queryValuesKey] && Array.isArray(args) && args.length > 0) {
    throw new Error('Both query.values and args were passed to query. Please use only one of them.')
  }

  return client.queryAsync(query[env.queryTextKey] || query, query[env.queryValuesKey] || args)
}

function constructLockingBeginStatement(involvedTables) {
  var lockSql = 'LOCK TABLE {table} IN SHARE ROW EXCLUSIVE MODE'
  var statements = involvedTables.map(function(table) {
    return stringTemplate(lockSql, { table: table })
  })
  statements.unshift('BEGIN')
  return statements.join(';')
}

function createUpsertCTE(table, idField, args) {
  var insert = args.insert
  var update = args.update

  return {
    text: 'with ' + formatQueryText(),
    values: getValues()
  }

  function getValues() { return update.values.concat(insert.values) }

  function formatQueryText() {
    var insertSql = rewriteInsertSql(insert.text, update.values.length)

    return stringTemplate(upsertQuery(), {
      table: table,
      update: update.text,
      uuid: idField,
      insert: insertSql
    })

    function selectQuery() {
      return '(select * from {table}_update) union all (select * from {table}_insert)'
    }
    function insertQuery() {
      return '{insert} where not exists (select * from {table}_update) returning {uuid}'
    }
    function updateQuery() {
      return '{update} returning {uuid}'
    }
    function upsertQuery() {
      return '{table}_update AS (' +
        updateQuery() +
        '), {table}_insert as (' +
        insertQuery() + ')' +
        selectQuery()
    }

    function rewriteInsertSql(text, count) {
      var i = 0
      return text.split('$').map(function(fragment) {
        return fragment.replace(/\d+/, (count + i++))
      }).join('$')
    }
  }
}

function createMultipleInsertCTE(insert) {
  var placeholders = insert.text.match(/\$\d+/g).map(function(param) { return parseInt(param.substring(1), 10)})
  assert.ok(_.isEqual(placeholders, _.range(1, placeholders.length + 1)), "Refer to the insert statement parameters in ascending order!")
  var numberOfParams = _.last(placeholders)
  var sqlValuesText = _.last(insert.text.split('values'))
  var valuesSegmentFragments = replaceParameters(numberOfParams, sqlValuesText, insert.values)

  return {
    text: insert.text.replace(sqlValuesText, valuesSegmentFragments.join(',')),
    values: insert.values
  }

  function replaceParameters(parameterCountInSql, sqlString, values) {
    var i = 1

    var valueSegmentCount = values.length / parameterCountInSql
    assert.ok(valueSegmentCount % 1 === 0, "Check that there are a multiple of parameter count values in the statement" + values.length + parameterCountInSql )
    return _.times(valueSegmentCount, function () {
      var split = sqlString.split(/\$\d+/)
      var omit = 0
      return _.map(split, function (fragment) {
        var isLastItemInFragment = ++omit % split.length === 0
        return isLastItemInFragment ? fragment : fragment + '$' + i++
      }).join('')
    })
  }
}

module.exports = function (env) {
  var poolConfig = _.assign({}, POOL_DEFAULTS, env)

  // backwards compatibility
  poolConfig.connectionString = env.dbUrl
  poolConfig.max = env.poolSize

  var pool = new pg.Pool(poolConfig)

  var connectMultiArgAsync = BPromise.promisify(pool.connect, { context: pool, multiArgs: true})

  var queryConfig = _.assign({}, QUERY_DEFAULTS, env)

  return {
    getConnection: getConnectionWithEnv,
    getTransaction: getTransactionWithEnv,
    queryAsync: queryRowsWithEnv,
    queryRowsAsync: queryRowsWithEnv,
    createMultipleInsertCTE: createMultipleInsertCTE,
    createUpsertCTE: createUpsertCTE,
    on: on,
    end: end
  }

  function getConnectionWithEnv() { return getConnection(queryConfig, connectMultiArgAsync) }

  function getTransactionWithEnv(tablesToLock) { return getTransaction(queryConfig, connectMultiArgAsync, tablesToLock) }

  function queryRowsWithEnv(query, args) { return executeQueryRowsAsync(queryConfig, connectMultiArgAsync, query, args)}

  function on(event, fn) {
    pool.on(event, fn)
  }

  function end() {
    return pool.end()
  }
}
