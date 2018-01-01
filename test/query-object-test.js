"use strict"; // eslint-disable-line semi

var pgrm = require('../index.js')
var configs = {dbUrl: "postgres://localhost/pgrm-tests"}
var pgrmWithDefaults = pgrm(configs)
var using = require('bluebird').using
var chai = require('chai')
var chaiAsPromised = require('chai-as-promised')
var assert = chai.assert

chai.use(chaiAsPromised)

describe('queryAsync with a query object', function () {
  beforeEach(function () {
    return using(pgrmWithDefaults.getConnection(), function (conn) {
      return conn.queryAsync("drop table if exists foo").then(function () {
        return conn.queryAsync("create table foo(bar integer unique, id serial)")
      })
    })
  })

  it('behaves correctly when using query object', function () {
    return pgrmWithDefaults.queryRowsAsync({text: "insert into foo(bar) values ($1)", values: [1]})
      .then(assertOneEventuallyInFoo)
  })

  it('throws an error if args is passed when using query object', function () {
    return pgrmWithDefaults.queryRowsAsync({text: "insert into foo(bar) values ($1)", values: [1]}, [1])
      .catch(function (err) {
        assert.equal(err, 'Error: Both query.values and args were passed to query. Please use only one of them.')
        return assertFooIsEventuallyEmpty()
      })
  })
})

function assertOneEventuallyInFoo() {
  return assert.eventually.deepEqual(pgrmWithDefaults.queryRowsAsync("select bar from foo"), [{bar: 1}])
}

function assertFooIsEventuallyEmpty() {
  return assert.eventually.deepEqual(pgrmWithDefaults.queryRowsAsync("select bar from foo"), [])
}
