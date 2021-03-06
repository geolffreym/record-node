/* global describe it beforeEach afterEach */

const assert = require('assert')
const {
  config,
  startRecord,
  connectNode
} = require('./utils')

describe('record.components.logs.connect', function () {
  this.timeout(config.timeout)
  let record1, record2

  beforeEach(async () => {
    // eslint-disable-next-line
    ({ record: record1 } = await startRecord('0'));
    // eslint-disable-next-line
    ({ record: record2 } = await startRecord('1'));
    await connectNode(record1, record2)
  })

  afterEach(async () => {
    try {
      record1 && await record1.stop()
      record2 && await record2.stop()
    } catch (e) {
      console.log(e)
    }
  })

  it('connect + isReplicating', async function () {
    await record1.logs.link({ linkAddress: record2.address })
    await record1.logs.connect(record2.address)
    const isReplicating = await record1.logs.isReplicating(record2.address)
    assert.strictEqual(isReplicating, true)
  })

  it('connect + add + has + isReplicating', async function () {
    await record1.logs.connect(record2.address)
    const linkedLog = await record1.logs.link({ linkAddress: record2.address })
    const has = await record1.logs.has(record1.address, linkedLog.content.address)
    const isReplicating = await record1.logs.isReplicating(record2.address)
    assert.strictEqual(isReplicating, true)
    assert.strictEqual(has, true)
  })

  it('connect + add + remove + disconnect + has + isReplicating', async function () {
    await record1.logs.connect(record2.address)
    const linkedLog = await record1.logs.link({ linkAddress: record2.address })
    await record1.logs.unlink(linkedLog.content.address)
    await record1.logs.disconnect(record2.address)
    const has = await record1.logs.has(record1.address, linkedLog.content.address)
    const isReplicating = await record1.logs.isReplicating(record2.address)
    assert.strictEqual(isReplicating, false)
    assert.strictEqual(has, false)
    // TODO (medium) check pubsub subscriptions
    // TODO (medium) check log OrbitDB replicator
  })

  it('connect + disconnect + add + has + isReplicating', async function () {
    await record1.logs.connect(record2.address)
    await record1.logs.disconnect(record2.address)
    const linkedLog = await record1.logs.link({ linkAddress: record2.address })
    const has = await record1.logs.has(record1.address, linkedLog.content.address)
    const isReplicating = await record1.logs.isReplicating(record2.address)
    assert.strictEqual(isReplicating, false)
    assert.strictEqual(has, true)
    // TODO (medium) check pubsub subscriptions
    // TODO (medium) check log OrbitDB replicator
  })

  it('disconnect + has + isReplicating', async function () {
    await record1.logs.disconnect(record2.address)
    const has = await record1.logs.has(record1.address, record2.address)
    const isReplicating = await record1.logs.isReplicating(record2.address)
    assert.strictEqual(isReplicating, false)
    assert.strictEqual(has, false)
    // TODO (medium) check pubsub subscriptions
    // TODO (medium) check log OrbitDB replicator
  })

  // TODO (high)
  /* describe('errors', function () {
   *   it('invalid address', async function () {

   *   })
   * }) */
})
