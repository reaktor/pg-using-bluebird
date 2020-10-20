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

describe('pool-event-test.js', function () {
  describe('on', () => {
    it('receives connect event', () => {
      let receivedEvent = false
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
