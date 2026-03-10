import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock node:fs/promises
vi.mock('node:fs/promises', () => ({
  default: {
    writeFile: vi.fn(),
    mkdir: vi.fn(),
  },
}))

import fs from 'node:fs/promises'
import type { ProjectConfig } from '../../prompts/project.js'
import { generateDevbox } from '../devbox.js'
import { generateDevContainer } from '../devcontainer.js'
import { generateReadme } from '../readme.js'

const mockWriteFile = vi.mocked(fs.writeFile)
const mockMkdir = vi.mocked(fs.mkdir)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('generateReadme', () => {
  const baseConfig: ProjectConfig = {
    projectName: 'my-app',
    projectPath: '/tmp/my-app',
    template: 'basic-blog',
  }

  it('writes README.md to the project path', async () => {
    await generateReadme('/tmp/my-app', baseConfig)
    expect(mockWriteFile).toHaveBeenCalledOnce()
    expect(mockWriteFile.mock.calls[0][0]).toBe('/tmp/my-app/README.md')
    expect(mockWriteFile.mock.calls[0][2]).toBe('utf-8')
  })

  it('includes the project name as heading', async () => {
    await generateReadme('/tmp/my-app', baseConfig)
    const content = mockWriteFile.mock.calls[0][1] as string
    expect(content).toMatch(/^# my-app/)
  })

  it('includes the template name', async () => {
    await generateReadme('/tmp/my-app', baseConfig)
    const content = mockWriteFile.mock.calls[0][1] as string
    expect(content).toContain('**basic-blog** template')
  })

  it('includes getting started instructions', async () => {
    await generateReadme('/tmp/my-app', baseConfig)
    const content = mockWriteFile.mock.calls[0][1] as string
    expect(content).toContain('pnpm install')
    expect(content).toContain('pnpm dev')
    expect(content).toContain('pnpm db:init')
  })

  it('includes project structure with project name', async () => {
    await generateReadme('/tmp/my-app', baseConfig)
    const content = mockWriteFile.mock.calls[0][1] as string
    expect(content).toContain('my-app/')
    expect(content).toContain('apps/')
    expect(content).toContain('packages/')
  })

  it('includes available scripts section', async () => {
    await generateReadme('/tmp/my-app', baseConfig)
    const content = mockWriteFile.mock.calls[0][1] as string
    expect(content).toContain('Available Scripts')
    expect(content).toContain('pnpm build')
    expect(content).toContain('pnpm test')
    expect(content).toContain('pnpm db:seed')
  })

  it('uses e-commerce template name when configured', async () => {
    const config: ProjectConfig = { ...baseConfig, template: 'e-commerce' }
    await generateReadme('/tmp/my-app', config)
    const content = mockWriteFile.mock.calls[0][1] as string
    expect(content).toContain('**e-commerce** template')
  })

  it('uses portfolio template name when configured', async () => {
    const config: ProjectConfig = { ...baseConfig, template: 'portfolio' }
    await generateReadme('/tmp/my-app', config)
    const content = mockWriteFile.mock.calls[0][1] as string
    expect(content).toContain('**portfolio** template')
  })
})

describe('generateDevbox', () => {
  it('writes devbox.json to the project path', async () => {
    await generateDevbox('/tmp/my-app')
    expect(mockWriteFile).toHaveBeenCalledOnce()
    expect(mockWriteFile.mock.calls[0][0]).toBe('/tmp/my-app/devbox.json')
    expect(mockWriteFile.mock.calls[0][2]).toBe('utf-8')
  })

  it('generates valid JSON', async () => {
    await generateDevbox('/tmp/my-app')
    const content = mockWriteFile.mock.calls[0][1] as string
    const parsed = JSON.parse(content)
    expect(parsed).toBeDefined()
  })

  it('includes required Node.js package', async () => {
    await generateDevbox('/tmp/my-app')
    const content = JSON.parse(mockWriteFile.mock.calls[0][1] as string)
    expect(content.packages).toContain('nodejs@24.13.0')
  })

  it('includes pnpm package', async () => {
    await generateDevbox('/tmp/my-app')
    const content = JSON.parse(mockWriteFile.mock.calls[0][1] as string)
    expect(content.packages).toContain('pnpm@10.28.2')
  })

  it('includes postgresql package', async () => {
    await generateDevbox('/tmp/my-app')
    const content = JSON.parse(mockWriteFile.mock.calls[0][1] as string)
    expect(content.packages).toContain('postgresql@16')
  })

  it('includes shell scripts', async () => {
    await generateDevbox('/tmp/my-app')
    const content = JSON.parse(mockWriteFile.mock.calls[0][1] as string)
    expect(content.shell.scripts).toEqual({
      dev: 'pnpm dev',
      setup: 'pnpm install && pnpm db:init',
      test: 'pnpm test',
    })
  })

  it('sets NODE_ENV to development', async () => {
    await generateDevbox('/tmp/my-app')
    const content = JSON.parse(mockWriteFile.mock.calls[0][1] as string)
    expect(content.env.NODE_ENV).toBe('development')
  })

  it('includes init_hook with corepack enable', async () => {
    await generateDevbox('/tmp/my-app')
    const content = JSON.parse(mockWriteFile.mock.calls[0][1] as string)
    expect(content.shell.init_hook).toContain('corepack enable')
  })
})

describe('generateDevContainer', () => {
  it('creates the .devcontainer directory', async () => {
    await generateDevContainer('/tmp/my-app')
    expect(mockMkdir).toHaveBeenCalledWith('/tmp/my-app/.devcontainer', {
      recursive: true,
    })
  })

  it('writes devcontainer.json', async () => {
    await generateDevContainer('/tmp/my-app')
    const calls = mockWriteFile.mock.calls
    const devcontainerCall = calls.find((c) => (c[0] as string).endsWith('devcontainer.json'))
    expect(devcontainerCall).toBeDefined()
  })

  it('writes docker-compose.yml', async () => {
    await generateDevContainer('/tmp/my-app')
    const calls = mockWriteFile.mock.calls
    const composeCall = calls.find((c) => (c[0] as string).endsWith('docker-compose.yml'))
    expect(composeCall).toBeDefined()
  })

  it('writes Dockerfile', async () => {
    await generateDevContainer('/tmp/my-app')
    const calls = mockWriteFile.mock.calls
    const dockerfileCall = calls.find((c) => (c[0] as string).endsWith('Dockerfile'))
    expect(dockerfileCall).toBeDefined()
  })

  it('writes README.md', async () => {
    await generateDevContainer('/tmp/my-app')
    const calls = mockWriteFile.mock.calls
    const readmeCall = calls.find((c) => (c[0] as string).endsWith('README.md'))
    expect(readmeCall).toBeDefined()
  })

  it('generates 4 files total', async () => {
    await generateDevContainer('/tmp/my-app')
    expect(mockWriteFile).toHaveBeenCalledTimes(4)
  })

  it('devcontainer.json contains valid JSON with expected fields', async () => {
    await generateDevContainer('/tmp/my-app')
    const calls = mockWriteFile.mock.calls
    const devcontainerCall = calls.find((c) => (c[0] as string).endsWith('devcontainer.json'))
    const config = JSON.parse(devcontainerCall![1] as string)
    expect(config.name).toBe('RevealUI Development')
    expect(config.forwardPorts).toEqual([3000, 4000, 5432])
    expect(config.remoteUser).toBe('node')
  })

  it('devcontainer.json includes Biome extension', async () => {
    await generateDevContainer('/tmp/my-app')
    const calls = mockWriteFile.mock.calls
    const devcontainerCall = calls.find((c) => (c[0] as string).endsWith('devcontainer.json'))
    const config = JSON.parse(devcontainerCall![1] as string)
    expect(config.customizations.vscode.extensions).toContain('biomejs.biome')
  })

  it('devcontainer.json sets Biome as default formatter', async () => {
    await generateDevContainer('/tmp/my-app')
    const calls = mockWriteFile.mock.calls
    const devcontainerCall = calls.find((c) => (c[0] as string).endsWith('devcontainer.json'))
    const config = JSON.parse(devcontainerCall![1] as string)
    expect(config.customizations.vscode.settings['editor.defaultFormatter']).toBe('biomejs.biome')
  })

  it('docker-compose.yml uses pgvector image', async () => {
    await generateDevContainer('/tmp/my-app')
    const calls = mockWriteFile.mock.calls
    const composeCall = calls.find((c) => (c[0] as string).endsWith('docker-compose.yml'))
    const content = composeCall![1] as string
    expect(content).toContain('pgvector/pgvector:pg16')
  })

  it('Dockerfile installs postgresql-client', async () => {
    await generateDevContainer('/tmp/my-app')
    const calls = mockWriteFile.mock.calls
    const dockerfileCall = calls.find((c) => (c[0] as string).endsWith('Dockerfile'))
    const content = dockerfileCall![1] as string
    expect(content).toContain('postgresql-client')
    expect(content).toContain('corepack enable')
  })
})
