/**
 * Seed script for the portfolio template.
 * Creates 3 sample projects via the RevealUI REST API.
 *
 * Usage: pnpm db:seed (requires the dev server to be running)
 */

const API_URL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:4000'

interface SeedProject {
  title: string
  slug: string
  description: string
  tags: Array<{ tag: string }>
  link: string
}

const projects: SeedProject[] = [
  {
    title: 'Weather Dashboard',
    slug: 'weather-dashboard',
    description:
      'A real-time weather dashboard built with React and a public weather API. Displays forecasts, radar maps, and severe weather alerts.',
    tags: [{ tag: 'React' }, { tag: 'TypeScript' }, { tag: 'API' }],
    link: 'https://github.com/example/weather-dashboard',
  },
  {
    title: 'Task Manager CLI',
    slug: 'task-manager-cli',
    description:
      'A command-line task manager written in TypeScript with SQLite storage, priority sorting, and due date reminders.',
    tags: [{ tag: 'TypeScript' }, { tag: 'Node.js' }, { tag: 'CLI' }],
    link: 'https://github.com/example/task-manager-cli',
  },
  {
    title: 'Design System',
    slug: 'design-system',
    description:
      'A component library with 30+ accessible UI primitives, built with Tailwind CSS and documented with Storybook.',
    tags: [{ tag: 'React' }, { tag: 'Tailwind CSS' }, { tag: 'Storybook' }],
    link: 'https://github.com/example/design-system',
  },
]

// biome-ignore lint/suspicious/noConsole: seed script is a standalone CLI tool
const log = (...args: unknown[]) => process.stdout.write(`${args.join(' ')}\n`)
const logErr = (...args: unknown[]) => process.stderr.write(`${args.join(' ')}\n`)

async function seed(): Promise<void> {
  log(`Seeding projects to ${API_URL}...`)

  for (const project of projects) {
    try {
      const res = await fetch(`${API_URL}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(project),
      })

      if (res.ok) {
        log(`  Created: ${project.title}`)
      } else {
        const error = await res.text()
        logErr(`  Failed to create "${project.title}": ${error}`)
      }
    } catch (err) {
      logErr(`  Error creating "${project.title}":`, err)
    }
  }

  log('Seeding complete.')
}

seed()
