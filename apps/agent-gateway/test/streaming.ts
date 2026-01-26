#!/usr/bin/env node
/**
 * Streaming integration test for Vultr provider.
 * Requires VULTR_API_KEY and VULTR_MODEL (optional) in env.
 */

if (!process.env.VULTR_API_KEY) {
  console.log('SKIP: VULTR_API_KEY not set')
  process.exit(0)
}

import vultr from '../../../packages/inference-clients/vultr'

async function run() {
  console.log('Starting Vultr streaming test')
  let gotDelta = false
  let collected = ''
  const timeoutMs = 20000

  const p = new Promise<void>(async (resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('stream timeout')), timeoutMs)
    try {
      await (vultr as any).stream({ prompt: 'Stream test: say short sentence', onDelta: (ev: any) => {
        if (ev.done) {
          clearTimeout(timer)
          resolve()
          return
        }
        if (ev.delta) {
          gotDelta = true
          collected += ev.delta
          process.stdout.write(ev.delta)
        }
      } })
    } catch (err) {
      clearTimeout(timer)
      reject(err)
    }
  })

  try {
    await p
    console.log('\nStream finished')
    if (!gotDelta) throw new Error('no deltas received')
    console.log('Vultr streaming test passed')
    process.exit(0)
  } catch (err) {
    console.error('\nVultr streaming test failed:', err)
    process.exit(2)
  }
}

run()
