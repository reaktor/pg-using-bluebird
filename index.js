"use strict"; // eslint-disable-line semi

var pg = require('pg'),
  _ = require('lodash'),
  BPromise = require('bluebird'),
  stringTemplate = require('string-template'),
  using = BPromise.using,
  assert = require('assert')

var POOL_DEFAULTS = {
  statementTimeout: '0', // the node-postgres default is no timeout
  poolSize : 20,
  ssl: false,
  queryValuesKey: 'values',
  queryTextKey: 'text'
}

// Do not try to parse a postgres DATE to a javascript Date.
pg.types.setTypeParser(1082, 'text', _.identity)

BPromise.promisifyAll(pg)
var pool
var connectMultiArgAsync

// TODO pool.error, have the client do it, document

function getConnection(env) {
  var releaseConnection

  return connectMultiArgAsync()
    .spread(function (client, done) {
      releaseConnection = done
      return client.queryAsync("SET statement_timeout TO '" + env.statementTimeout + "'")
        .then(function () { return withQueryRowsAsync(env, client) })
    })
    .disposer(function () {
      releaseConnectionToPool(releaseConnection)
    })
}

function getTransaction(env, tablesToLock_) {
  var tablesToLock = tablesToLock_ || []
  var releaseConnection

  return connectMultiArgAsync()
    .spread(function (client, done) {
      releaseConnection = done
      return client.queryAsync("SET statement_timeout TO '" + env.statementTimeout + "'")
        .then(function () { return client.queryAsync(constructLockingBeginStatement(tablesToLock)) })
        .then(function () { return withQueryRowsAsync(env, client) })
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

function withQueryRowsAsync(env, client) {
  return Object.assign(client, {
    queryRowsAsync: (query, args) => queryAsync(env, client, query, args).then(getRows)
  })
}

function queryRowsAsync(env, query, args) {
  var argsArray = args || []
  return using(getConnection(env), function (connection) {
    return queryAsync(env, connection, query, argsArray)
  }).then(getRows)
}

function getRows(res) {
  return res.rows
}

function queryAsync(env, client, query, args) {
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
  var envWithDefaults = _.assign({}, POOL_DEFAULTS, env)
  pg.defaults.poolSize = envWithDefaults.poolSize
  pg.defaults.ssl = envWithDefaults.ssl

  // TODO split pool conf and execution env

  envWithDefaults.connectionString = env.dbUrl
  pool = new pg.Pool(envWithDefaults)

  connectMultiArgAsync = BPromise.promisify(pool.connect, { context: pool, multiArgs: true})

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

  function getConnectionWithEnv() { return getConnection(envWithDefaults) }

  function getTransactionWithEnv(tablesToLock) { return getTransaction(envWithDefaults, tablesToLock) }

  function queryRowsWithEnv(query, args) { return queryRowsAsync(envWithDefaults, query, args)}

  function on(event, fn) {
    pg.on(event, fn)
  }

  function end() {
    pool.end()
  }
}
