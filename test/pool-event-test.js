"use strict"; // eslint-disable-line semi

var pgrm = require('../index.js')
var configs = {dbUrl: "postgres://localhost/pgrm-tests"}
var BPromise = require('bluebird')
var using = BPromise.using
var pgrmWithDefaults = pgrm(configs)
var chai = require('chai')
var chaiAsPromised = require('chai-as-promised')

chai.use(chaiAsPromised)
var assert = chai.assert

describe('pool-event-test.js', function () {
  describe('on', () => {
    it('receives connect event', () => {
      var receivedEvent = false
      pgrmWithDefaults.on('connect', () => { receivedEvent = true })
      return using(pgrmWithDefaults.getConnection(), () => assert.equal(receivedEvent, true))
    })
  })

  describe('end', () => {
    it('ends the pool', () =>
      assert.isFulfilled(pgrmWithDefaults.end())
    )
  })
})
