#!/usr/bin/env node
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const providers = [
  { name: 'vultr', module: '../../../packages/inference-clients/vultr.ts', env: 'VULTR_API_KEY' },
  {
    name: 'huggingface',
    module: '../../../packages/inference-clients/huggingface.ts',
    env: 'HF_TOKEN',
  },
  // Docker can be configured via DOCKER_INFERENCE_URL, DOCKER_MODEL_URL, or DOCKER_MODEL_BASE + DOCKER_MODEL_PATH
  {
    name: 'docker',
    module: '../../../packages/inference-clients/docker.ts',
    env: 'DOCKER_INFERENCE_URL|DOCKER_MODEL_URL|DOCKER_MODEL_BASE',
  },
]

function timeoutPromise<T>(p: Promise<T>, ms: number) {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)),
  ])
}

async function run() {
  console.log('Provider integration test started')
  let failed = false

  for (const p of providers) {
    const required = p.env
    if (required) {
      const any = required.split('|').some((k) => !!process.env[k])
      if (!any) {
        console.log(`- SKIP ${p.name}: missing env ${required}`)
        continue
      }
    }

    try {
      const mod = await import(join(__dirname, p.module))
      const provider = (mod as any).default || mod
      console.log(`- RUN ${p.name}`)

      const result = await timeoutPromise(
        provider.generate({
          prompt: 'Integration test: say hi',
          messages: [{ role: 'user', content: 'hi' }],
        }),
        20000,
      )

      if (!result || typeof (result as any).text !== 'string') {
        console.error(`  -> FAIL ${p.name}: invalid response`, result)
        failed = true
      } else {
        console.log(`  -> OK ${p.name}: ${String((result as any).text).slice(0, 120)}`)
      }
    } catch (err) {
      console.error(`  -> ERROR ${p.name}: ${String(err)}`)
      failed = true
    }
  }

  if (failed) {
    console.error('Provider integration test: FAILED')
    process.exit(2)
  }

  console.log('Provider integration test: ALL PASSED or SKIPPED')
  process.exit(0)
}

run()
