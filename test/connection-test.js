"use strict"; // eslint-disable-line semi

const pgrm = require('../index.js')
const pgConfig = {dbUrl: "postgres://localhost/pgrm-tests"}
const BPromise = require('bluebird')
const using = BPromise.using
const pgrmWithDefaults = pgrm(pgConfig)
const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')

chai.use(chaiAsPromised)
const assert = chai.assert

const QUERY_CANCELED = '57014' // http://www.postgresql.org/docs/9.4/static/errcodes-appendix.html

describe('connection-test.js', function () {
  beforeEach(() =>
    using(pgrmWithDefaults.getConnection(), conn =>
      conn.queryAsync("drop table if exists foo").then(() =>
        conn.queryAsync("create table foo(bar integer unique, id serial)")
      )))

  describe('configuration', function () {
    it('disables parsing of SQL dates to javascript dates', () =>
      assert.eventually.deepEqual(
        pgrmWithDefaults.queryRowsAsync("select date('2015-03-30') as the_date"),
        [{the_date: '2015-03-30'}])
    )
  })

  describe('single queries', function () {
    it('queryRowsAsync returns the rows of the result', () =>
      pgrmWithDefaults.queryRowsAsync("insert into foo(bar) values ($1)", [1])
        .then(() => pgrmWithDefaults.queryRowsAsync("select bar from foo"))
        .then(rows => assert.deepEqual(rows, [{ bar: 1 }]))
    )

    it('queryAsync returns the result object', () =>
      pgrmWithDefaults.queryAsync("insert into foo(bar) values ($1)", [1])
        .then(() => pgrmWithDefaults.queryAsync("select bar from foo"))
        .tap(resultObj => assert.equal(resultObj.rowCount, 1))
        .then(resultObj => assert.deepEqual(resultObj.rows, [{ bar: 1 }]))
    )
  })

  describe('connections', function () {
    it('return the result object', () =>
      using(pgrmWithDefaults.getConnection(), assertResponseObj)
    )

    it('commit automatically', () =>
      using(pgrmWithDefaults.getConnection(), insert1IntoFoo)
        .then(assertOneEventuallyInFoo)
    )

    it('do not rollback errors', () =>
      using(pgrmWithDefaults.getConnection(), conn =>
        insert1IntoFoo(conn)
          .then(throwAnError))
        .catch(assertOneEventuallyInFoo)
    )
  })

  describe('timeouts', function () {
    it('cause rollback', () =>
      using(pgrmWithDefaults.getTransaction(),
        tx =>
          tx.queryAsync("SET statement_timeout TO '100ms'")
            .then(() => insert1IntoFoo(tx))
            .then(() => causeAndAssertATimeout(tx))
            .then(assertFooIsEventuallyEmpty)
      )
    )

    describe('can be configured on pgrm level', function () {
      const pgrmWithShortTimeout = pgrm(Object.assign({}, pgConfig, {statementTimeout: '1ms'}))

      it('for transactions', () =>
        using(pgrmWithShortTimeout.getTransaction(), causeAndAssertATimeout)
      )

      it('for connections', () =>
        using(pgrmWithShortTimeout.getConnection(), causeAndAssertATimeout)
      )
    })

    describe('can be configured per session', function () {
      it('for transactions', () =>
        using(pgrmWithDefaults.getTransaction(), tx =>
          tx.queryAsync("SET statement_timeout TO '1ms'")
            .then(() => causeAndAssertATimeout(tx))
        )
      )

      it('for connections', () =>
        using(pgrmWithDefaults.getConnection(), conn =>
          conn.queryAsync("SET statement_timeout TO '1ms'")
            .then(() => causeAndAssertATimeout(conn))
        )
      )
    })
  })

  describe('transactions', function () {
    it('return the result object', () =>
      using(pgrmWithDefaults.getTransaction(), assertResponseObj)
    )

    it('are committed if there are no exceptions', () =>
      using(pgrmWithDefaults.getTransaction(), insert1IntoFoo)
        .then(assertOneEventuallyInFoo)
    )

    it('are rollbacked in case of exceptions within the using-block', () =>
      using(pgrmWithDefaults.getTransaction(), tx =>
        insert1IntoFoo(tx).then(throwAnError)
      ).catch(assertFooIsEventuallyEmpty)
    )

    it('are rollbacked in case of SQL exceptions', () =>
      using(pgrmWithDefaults.getTransaction(), tx =>
        insert1IntoFoo(tx)
          .then(assertOneEventuallyInFoo)
          .then(() =>
            tx.queryAsync("this is not sql")
          )
      ).catch(assertFooIsEventuallyEmpty)
    )

    describe('support locking of tables', function () {
      it('and do not lock anything by default and be in read committed isolation level', () =>
        using(pgrmWithDefaults.getTransaction(), outerTx =>
          using(pgrmWithDefaults.getTransaction(), innerTx =>
            insert1IntoFoo(outerTx)
              .then(() => innerTx.queryAsync('insert into foo(bar) values(2)'))
              .then(() =>
                assert.eventually.deepEqual(
                  BPromise.all([
                    outerTx.queryRowsAsync("select * from foo"),
                    innerTx.queryRowsAsync("select * from foo"),
                    pgrmWithDefaults.queryRowsAsync("select * from foo")]),
                  [
                    [{ bar: 1, id: 1 }],
                    [{ bar: 2, id: 2 }],
                    []
                  ])
              )
          )
        ).then(() =>
          assert.eventually.deepEqual(
            pgrmWithDefaults.queryRowsAsync("select bar from foo order by bar"),
            [{ bar: 1 }, { bar: 2 }])
        )
      )

      it('and lock the given table', function () {
        let selectingTxFn
        const selectingTxP = new BPromise(resolve => { selectingTxFn = resolve })

        const earlierTxP = using(pgrmWithDefaults.getTransaction(['foo']), earlierTx => {
          using(pgrmWithDefaults.getTransaction(['foo']), laterTx => {
            selectingTxFn(laterTx.queryAsync("select bar from foo").then(res => res.rows))
          })
          return BPromise.delay(100)
            .then(() => insert1IntoFoo(earlierTx))
            .then(() => 'inserted')
        })
        return assert.eventually.deepEqual(
          BPromise.all([earlierTxP, selectingTxP]),
          ['inserted', [{bar: 1}]])
      })
    })

  })

  describe('withConnection', function () {
    it('wraps using() and getConnection()', () =>
      pgrmWithDefaults.withConnection(assertResponseObj)
    )

    it('does not rollback errors', () =>
      pgrmWithDefaults.withConnection(conn =>
        insert1IntoFoo(conn).then(throwAnError)
      ).catch(assertOneEventuallyInFoo)
    )
  })

  describe('withTransaction', function () {
    it('wraps using() and getTransaction()', () =>
      pgrmWithDefaults.withTransaction(assertResponseObj)
    )

    it('rolls back the transaction if the function throws', () =>
      pgrmWithDefaults.withTransaction(tx =>
        insert1IntoFoo(tx).then(throwAnError)
      ).catch(assertFooIsEventuallyEmpty)
    )
  })

  function insert1IntoFoo(connOrTx) {
    return connOrTx.queryAsync("insert into foo (bar) values (1)")
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
    return assert.isRejected(txOrConn.queryAsync('SELECT pg_sleep(100)')
      .catch(assertErrCodeIsQueryCanceled), /canceling statement due to statement timeout/)
  }

  function assertResponseObj(connOrTx) {
    return () => {
      insert1IntoFoo(connOrTx).then(function assertResponseObject(conn) {
        return () =>
          conn.queryAsync('SELECT bar from foo').then(res => {
            assert.equal(res.rowCount, 1)
            assert.equal(res.command, 'SELECT')
            assert.deepEqual(res.rows, [{bar: 1}])
          })
      }).then(function assertRowsObject(conn) {
        return () =>
          conn.queryRowsAsync('SELECT bar from foo').then(rows => {
            assert.deepEqual(rows, [{bar: 1}])
          })
      })
    }
  }

  function throwAnError() {
    throw new Error('an error after the insertion has happened')
  }
})
