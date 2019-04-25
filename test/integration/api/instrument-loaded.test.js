const test  = require('tap').test
const mongodb = require('mongodb')
const Shim = require('../../../lib/shim/shim')
const API    = require('../../../api')
const agentHelper = require('../../lib/agent_helper')



test('instrumentation that uses shim.require (mongodb) can run without an error', function testLoadMongodb(t) {
    const agent = agentHelper.instrumentMockedAgent()
    const shimHelper = new Shim(agent, 'fake')
    const api = new API(agent)

    api.instrumentLoadedModule('mongodb', mongodb)
    t.type(mongodb, 'function')
    t.end()
})
