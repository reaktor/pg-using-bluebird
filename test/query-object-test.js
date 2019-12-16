"use strict"; // eslint-disable-line semi

const pgrm = require('../index.js')
const pgConfig = {dbUrl: "postgres://localhost/pgrm-tests"}
const pgrmWithDefaults = pgrm(pgConfig)
const using = require('bluebird').using
const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')
const pgrmWithCustomKeys = pgrm(Object.assign(pgConfig,
  { queryTextKey: 'customQueryTextKey', queryValuesKey: 'customQueryValuesKey' }))

chai.use(chaiAsPromised)
const assert = chai.assert

describe('query-object-test.js', function () {
  beforeEach(() =>
    using(pgrmWithDefaults.getConnection(), conn =>
      conn.queryAsync("drop table if exists foo").then(() =>
        conn.queryAsync("create table foo(bar integer unique, id serial)")
      )))

  it('behaves correctly when using query object', () =>
    pgrmWithDefaults.queryRowsAsync({text: "insert into foo(bar) values ($1)", values: [1]})
      .then(assertOneEventuallyInFoo)
  )

  it('throws an error if args is passed when using query object', () =>
    pgrmWithDefaults.queryRowsAsync({text: "insert into foo(bar) values ($1)", values: [1]}, [1])
      .catch(err => {
        assert.equal(err, 'Error: Both query.values and args were passed to query. Please use only one of them.')
        return assertFooIsEventuallyEmpty()
      })
  )

  it('works with custom query text and values keys', () =>
    pgrmWithCustomKeys.queryRowsAsync({
      customQueryTextKey: "insert into foo(bar) values ($1)",
      customQueryValuesKey: [1]
    })
      .then(assertOneEventuallyInFoo)
  )
})

function assertOneEventuallyInFoo() {
  return assert.eventually.deepEqual(pgrmWithDefaults.queryRowsAsync("select bar from foo"), [{bar: 1}])
}

function assertFooIsEventuallyEmpty() {
  return assert.eventually.deepEqual(pgrmWithDefaults.queryRowsAsync("select bar from foo"), [])
}
