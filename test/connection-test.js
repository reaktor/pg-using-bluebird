"use strict"; // eslint-disable-line semi

var pgrm = require('../index.js')
var configs = {dbUrl: "postgres://localhost/pgrm-tests"}
var BPromise = require('bluebird'),
  using = BPromise.using,
  pgrmWithDefaults = pgrm(configs),
  chai = require('chai'),
  chaiAsPromised = require('chai-as-promised'),
  _ = require('lodash')

chai.use(chaiAsPromised)
var assert = chai.assert

var QUERY_CANCELED = '57014' // http://www.postgresql.org/docs/9.4/static/errcodes-appendix.html

describe('connection-test.js', function () {
  beforeEach(function () {
    return using(pgrmWithDefaults.getConnection(), function (conn) {
      return conn.queryAsync("drop table if exists foo").then(function () {
        return conn.queryAsync("create table foo(bar integer unique, id serial)")
      })
    })
  })
  describe('configuration', function () {
    it('disables parsing of SQL dates to javascript dates', function () {
      return assert.eventually.deepEqual(pgrmWithDefaults.queryRowsAsync("select date('2015-03-30') as the_date"), [{the_date: '2015-03-30'}])
    })
  })
  describe('shortcut queryRowsAsync', function () {
    it('returns the rows of the result', function () {
      return pgrmWithDefaults.queryRowsAsync("insert into foo(bar) values ($1)", [1]).then(assertOneEventuallyInFoo)
    })
    it('is has an alias queryAsync until the next breaking change release', function() {
      return pgrmWithDefaults.queryAsync("insert into foo(bar) values ($1)", [1]).then(assertOneEventuallyInFoo)
    })
  })
  describe('connections', function () {
    it('return the result object', function () {
      return using(pgrmWithDefaults.getConnection(), assertResponseObj)
    })
    it('commit automatically', function () {
      return using(pgrmWithDefaults.getConnection(), insert1IntoFoo)
        .then(assertOneEventuallyInFoo)
    })
    it('do not rollback errors', function () {
      return using(pgrmWithDefaults.getConnection(), function (conn) {
        return insert1IntoFoo(conn).then(throwAnError)
      }).catch(assertOneEventuallyInFoo)
    })
  })
  describe('timeouts', function () {
    it('cause rollback', function () {
      return using(pgrmWithDefaults.getTransaction(),
        function (tx) {
          return tx.queryAsync("SET statement_timeout TO '100ms'")
            .then(function () { return insert1IntoFoo(tx) })
            .then(function () { return causeAndAssertATimeout(tx) })
            .then(assertFooIsEventuallyEmpty)
        })
    })
    describe('can be configured on pgrm level', function () {
      var pgrmWithShortTimeout = pgrm(_.assign({}, configs, {statementTimeout: '1ms'}))
      it('for transactions', function () {
        return using(pgrmWithShortTimeout.getTransaction(), causeAndAssertATimeout)
      })
      it('for connections', function () {
        return using(pgrmWithShortTimeout.getConnection(), causeAndAssertATimeout)
      })
    })
    describe('can be configured per session', function () {
      it('for transactions', function () {
        return using(pgrmWithDefaults.getTransaction(), function (tx) {
          return tx.queryAsync("SET statement_timeout TO '1ms'").then(function () { return causeAndAssertATimeout(tx) })
        })
      })
      it('for connections', function () {
        return using(pgrmWithDefaults.getConnection(), function (conn) {
          return conn.queryAsync("SET statement_timeout TO '1ms'").then(function () { return causeAndAssertATimeout(conn) })
        })
      })
    })
  })
  describe('transactions', function () {
    it('return the result object', function () {
      return using(pgrmWithDefaults.getTransaction(), assertResponseObj)
    })
    it('are committed if there are no exceptions', function () {
      return using(pgrmWithDefaults.getTransaction(), insert1IntoFoo)
        .then(assertOneEventuallyInFoo)
    })
    it('are rollbacked in case of exceptions within the using-block', function () {
      return using(pgrmWithDefaults.getTransaction(), function (tx) {
        return insert1IntoFoo(tx).then(throwAnError)
      }).catch(assertFooIsEventuallyEmpty)
    })
    it('are rollbacked in case of SQL exceptions', function () {
      return using(pgrmWithDefaults.getTransaction(), function (tx) {
        return insert1IntoFoo(tx)
          .then(assertOneEventuallyInFoo)
          .then(function () {
            return tx.queryAsync("this is not sql")
          })
      }).catch(assertFooIsEventuallyEmpty)
    })

    describe('support locking of tables', function () {
      it('and do not lock anything by default and are in read committed isolation level', function () {
        return using(pgrmWithDefaults.getTransaction(), function (outerTx) {
          return using(pgrmWithDefaults.getTransaction(), function (innerTx) {
            return insert1IntoFoo(outerTx).then(function () {
              return innerTx.queryAsync('insert into foo(bar) values(2)')
            }).then(function () {
              return assert.eventually.deepEqual(BPromise.all([
                outerTx.queryAsync("select * from foo").then(function (res) {return res.rows}),
                innerTx.queryAsync("select * from foo").then(function (res) {return res.rows}),
                pgrmWithDefaults.queryAsync("select * from foo")]),
              [
                [{bar: 1, id: 1}],
                [{bar: 2, id: 2}],
                []
              ])
            })
          })
        }).then(function () {
          return assert.eventually.deepEqual(pgrmWithDefaults.queryRowsAsync("select bar from foo order by bar"), [{bar: 1}, {bar: 2}])
        })
      })

      it('and lock the given table', function () {
        var selectingTxFn
        var selectingTxP = new BPromise(function (resolve) { selectingTxFn = resolve })

        var earlierTxP = using(pgrmWithDefaults.getTransaction(['foo']), function (earlierTx) {
          using(pgrmWithDefaults.getTransaction(['foo']), function (laterTx) {
            selectingTxFn(laterTx.queryAsync("select bar from foo").then(function (res) { return res.rows }))
          })
          return BPromise.delay(100).then(function () {
            return insert1IntoFoo(earlierTx).then(function () { return 'inserted'})
          })
        })
        return assert.eventually.deepEqual(BPromise.all([earlierTxP, selectingTxP]), ['inserted', [{bar: 1}]])
      })
    })

  })

  function insert1IntoFoo(connOrTx) {
    return connOrTx.queryAsync("insert into foo(bar) values (1)")
  }

  function assertOneEventuallyInFoo() {
    return assert.eventually.deepEqual(pgrmWithDefaults.queryRowsAsync("select bar from foo"), [{bar: 1}])
  }

  function assertFooIsEventuallyEmpty() {
    return assert.eventually.deepEqual(pgrmWithDefaults.queryRowsAsync("select bar from foo"), [])
  }

  function assertErrCodeIsQueryCanceled(err) {
    assert.equal(err.code, QUERY_CANCELED)
    throw err
  }

  function causeAndAssertATimeout(txOrConn) {
    return assert.isRejected(txOrConn.queryAsync('SELECT pg_sleep(100)').catch(assertErrCodeIsQueryCanceled), /canceling statement due to statement timeout/)
  }

  function assertResponseObj(connOrTx) {
    return function () {
      insert1IntoFoo(connOrTx).then(function assertResponseObject(conn) {
        return function () {
          return conn.queryAsync('SELECT bar from foo').then(function (res) {
            assert.equal(res.rowCount, 1)
            assert.equal(res.command, 'SELECT')
            assert.deepEqual(res.rows, [{bar: 1}])
          })
        }
      }).then(function assertRowsObject(conn) {
        return function () {
          return conn.queryRowsAsync('SELECT bar from foo').then(function (rows) {
            assert.deepEqual(rows, [{bar: 1}])
          })
        }
      })
    }
  }


  function throwAnError() {
    throw new Error('an error after the insertion has happened')
  }
})
