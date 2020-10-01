"use strict"; // eslint-disable-line semi

const pgrm = require('../index.js')
const pgConfig = { dbUrl: "postgres://localhost/pgrm-tests" }
const pgrmWithDefaults = pgrm(pgConfig)
const using = require('bluebird').using
const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')

chai.use(chaiAsPromised)
const assert = chai.assert

describe('query-object-test.js', function () {
  beforeEach(() =>
    using(pgrmWithDefaults.getConnection(), conn =>
      conn.queryAsync("drop table if exists foo").then(() =>
        conn.queryAsync("create table foo(bar integer unique, id serial)")
      ))
  )

  describe('implicit connection queries', () => {
    it('queryAsync behaves correctly called with query object', () =>
      pgrmWithDefaults.queryAsync({ text: "insert into foo(bar) values ($1)", values: [1] })
        .then(assertOneEventuallyInFoo)
    )

    it('queryAsync behaves correctly when called with text parameter', () =>
      pgrmWithDefaults.queryAsync("insert into foo(bar) values ($1)", [1])
        .then(assertOneEventuallyInFoo)
    )

    it('queryRowsAsync behaves correctly when using query object', () =>
      pgrmWithDefaults.queryRowsAsync({ text: "insert into foo(bar) values ($1)", values: [1] })
        .then(assertOneEventuallyInFoo)
    )

    it('queryRowsAsync behaves correctly when using query object', () =>
      pgrmWithDefaults.queryRowsAsync("insert into foo(bar) values ($1)", [1])
        .then(assertOneEventuallyInFoo)
    )
  })

})

function assertOneEventuallyInFoo() {
  return assert.eventually.deepEqual(pgrmWithDefaults.queryRowsAsync("select bar from foo"), [{ bar: 1 }])
}
