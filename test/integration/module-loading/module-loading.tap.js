/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const path = require('path')

const helper = require('../../lib/agent_helper')
const shimmer = require('../../../lib/shimmer')
const symbols = require('../../../lib/symbols')
const { FEATURES } = require('../../../lib/metrics/names')

const CUSTOM_MODULE = 'customTestPackage'
const CUSTOM_MODULE_PATH = `./node_modules/${CUSTOM_MODULE}`
const CUSTOM_MODULE_PATH_SUB = `./node_modules/subPkg/node_modules/${CUSTOM_MODULE}`
const EXPECTED_REQUIRE_METRIC_NAME = `${FEATURES.INSTRUMENTATION.ON_REQUIRE}/${CUSTOM_MODULE}`

tap.test('Should properly track module paths to enable shim.require()', function (t) {
  t.autoend()

  let agent = helper.instrumentMockedAgent()

  t.teardown(() => {
    helper.unloadAgent(agent)
    agent = null
  })

  shimmer.registerInstrumentation({
    moduleName: CUSTOM_MODULE,
    onRequire: () => {}
  })

  const mycustomPackage = require(CUSTOM_MODULE_PATH)

  const shim = mycustomPackage[symbols.shim]
  const moduleRoot = shim._moduleRoot

  const resolvedPackagePath = path.resolve(__dirname, CUSTOM_MODULE_PATH)
  t.equal(moduleRoot, resolvedPackagePath)

  const shimLoadedCustom = shim.require('custom')
  t.ok(shimLoadedCustom, 'shim.require() should load module')
  t.equal(shimLoadedCustom.name, 'customFunction', 'Should grab correct module')
})

tap.test('should instrument multiple versions of the same package', function (t) {
  t.autoend()

  let agent = helper.instrumentMockedAgent()

  t.teardown(() => {
    helper.unloadAgent(agent)
    agent = null
  })

  const instrumentation = {
    moduleName: CUSTOM_MODULE,
    onRequire: () => {}
  }

  shimmer.registerInstrumentation(instrumentation)

  const pkg1 = require(CUSTOM_MODULE_PATH)
  const pkg2 = require(CUSTOM_MODULE_PATH_SUB)
  t.ok(pkg1[symbols.shim], 'should wrap first package')
  t.ok(pkg2[symbols.shim], 'should wrap sub package of same name, different version')
  t.ok(instrumentation[symbols.instrumented].has('3.0.0'))
  t.ok(instrumentation[symbols.instrumented].has('1.0.0'))
})

tap.test('should only log supportability metric for tracking type instrumentation', function (t) {
  t.autoend()

  let agent = helper.instrumentMockedAgent()

  t.teardown(() => {
    helper.unloadAgent(agent)
    agent = null
  })

  const PKG = `${FEATURES.INSTRUMENTATION.ON_REQUIRE}/knex`
  const PKG_VERSION = `${FEATURES.INSTRUMENTATION.ON_REQUIRE}/knex/Version/1`

  // eslint-disable-next-line node/no-extraneous-require
  require('knex')
  const knexOnRequiredMetric = agent.metrics._metrics.unscoped[PKG]
  t.equal(knexOnRequiredMetric.callCount, 1, `should record ${PKG}`)
  const knexVersionMetric = agent.metrics._metrics.unscoped[PKG_VERSION]
  t.equal(knexVersionMetric.callCount, 1, `should record ${PKG_VERSION}`)
  t.ok(shimmer.isInstrumented('knex'), 'should mark tracking modules as instrumented')
  t.end()
})

tap.test('shim.require() should play well with multiple test runs', (t) => {
  simulateTestLoadAndUnload()

  let agent = helper.instrumentMockedAgent()

  shimmer.registerInstrumentation({
    moduleName: CUSTOM_MODULE,
    onRequire: () => {}
  })

  t.teardown(() => {
    helper.unloadAgent(agent)
    agent = null
  })

  require(CUSTOM_MODULE_PATH)
  const mycustomPackage = require(CUSTOM_MODULE_PATH)

  const shim = mycustomPackage[symbols.shim]
  const moduleRoot = shim._moduleRoot

  const resolvedPackagePath = path.resolve(__dirname, CUSTOM_MODULE_PATH)
  t.equal(moduleRoot, resolvedPackagePath)

  const shimLoadedCustom = shim.require('custom')
  t.ok(shimLoadedCustom, 'shim.require() should load module')
  t.equal(shimLoadedCustom.name, 'customFunction', 'Should grab correct module')

  t.end()
})

tap.test('Should create usage metric onRequire', (t) => {
  let agent = helper.instrumentMockedAgent()

  t.teardown(() => {
    helper.unloadAgent(agent)
    agent = null
  })

  shimmer.registerInstrumentation({
    moduleName: CUSTOM_MODULE,
    onRequire: onRequireHandler
  })

  require(CUSTOM_MODULE_PATH)

  function onRequireHandler() {
    const onRequireMetric = agent.metrics._metrics.unscoped[EXPECTED_REQUIRE_METRIC_NAME]

    t.ok(onRequireMetric)
    t.equal(onRequireMetric.callCount, 1)

    t.end()
  }
})

tap.test('Should create usage version metric onRequire', (t) => {
  let agent = helper.instrumentMockedAgent()

  t.teardown(() => {
    helper.unloadAgent(agent)
    agent = null
  })

  shimmer.registerInstrumentation({
    moduleName: CUSTOM_MODULE,
    onRequire: onRequireHandler
  })

  require(CUSTOM_MODULE_PATH)

  function onRequireHandler() {
    const expectedVersionMetricName = `${EXPECTED_REQUIRE_METRIC_NAME}/Version/3`

    const onRequireMetric = agent.metrics._metrics.unscoped[expectedVersionMetricName]

    t.ok(onRequireMetric)
    t.equal(onRequireMetric.callCount, 1)

    t.end()
  }
})

function simulateTestLoadAndUnload() {
  const agent = helper.instrumentMockedAgent()

  shimmer.registerInstrumentation({
    moduleName: CUSTOM_MODULE
  })

  require(CUSTOM_MODULE_PATH)

  helper.unloadAgent(agent)
}
