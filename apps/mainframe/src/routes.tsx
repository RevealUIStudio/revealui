import type { Route } from '@revealui/router'
import React from 'react'
import { Builder } from './components/Builder/Builder.js'
import {
  HomeBackground,
  HomeCard,
  HomeContent,
  HomeHeader,
  HomeHero,
  HomeMain,
  HomeSection,
} from './components/Home/index.js'

// ---------------------------------------------------------------------------
// Home Page
// ---------------------------------------------------------------------------

function HomePage(): React.ReactElement {
  const [showBuilder, setShowBuilder] = React.useState(false)

  if (showBuilder) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          <header className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">RevealUI Builder</h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-6">
              Create beautiful applications without coding. Drag, drop, and deploy to Vercel
              instantly.
            </p>
            <button
              onClick={() => setShowBuilder(false)}
              type="button"
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              ← Back to Home
            </button>
          </header>
          <Builder />
        </div>
      </div>
    )
  }

  return (
    <HomeBackground>
      <HomeHeader />
      <div className="text-center mb-8">
        <button
          onClick={() => setShowBuilder(true)}
          type="button"
          className="px-8 py-4 bg-blue-600 text-white text-xl font-bold rounded-lg hover:bg-blue-700 transition-colors"
        >
          Try the Visual Builder
        </button>
      </div>
      <HomeCard />
      <HomeSection />
      <HomeMain />
      <HomeHero />
      <HomeContent />
    </HomeBackground>
  )
}

// ---------------------------------------------------------------------------
// Builder Page
// ---------------------------------------------------------------------------

function BuilderPage(): React.ReactElement {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">RevealUI Builder</h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-6">
            Create beautiful applications without coding. Drag, drop, and deploy to Vercel
            instantly.
          </p>
        </header>
        <Builder />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Components Showcase Page
// ---------------------------------------------------------------------------

const COMPONENT_GROUPS: Array<{
  name: string
  items: Array<{ label: string; preview: React.ReactNode }>
}> = [
  {
    name: 'Buttons',
    items: [
      {
        label: 'Primary',
        preview: (
          <button
            type="button"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
          >
            Primary Button
          </button>
        ),
      },
      {
        label: 'Secondary',
        preview: (
          <button
            type="button"
            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm font-medium"
          >
            Secondary Button
          </button>
        ),
      },
      {
        label: 'Destructive',
        preview: (
          <button
            type="button"
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm font-medium"
          >
            Delete
          </button>
        ),
      },
    ],
  },
  {
    name: 'Badges',
    items: [
      {
        label: 'Success',
        preview: (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            Published
          </span>
        ),
      },
      {
        label: 'Warning',
        preview: (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            Draft
          </span>
        ),
      },
      {
        label: 'Error',
        preview: (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            Failed
          </span>
        ),
      },
    ],
  },
  {
    name: 'Form Controls',
    items: [
      {
        label: 'Text Input',
        preview: (
          <input
            type="text"
            placeholder="Enter value…"
            className="w-48 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        ),
      },
      {
        label: 'Select',
        preview: (
          <select className="w-48 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option>Option A</option>
            <option>Option B</option>
            <option>Option C</option>
          </select>
        ),
      },
      {
        label: 'Checkbox',
        preview: (
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" defaultChecked className="rounded" />
            Enable feature
          </label>
        ),
      },
    ],
  },
  {
    name: 'Cards',
    items: [
      {
        label: 'Basic Card',
        preview: (
          <div className="w-56 bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Card Title</h3>
            <p className="text-xs text-gray-500">Card description goes here.</p>
          </div>
        ),
      },
      {
        label: 'Stat Card',
        preview: (
          <div className="w-56 bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <p className="text-xs text-gray-500 mb-1">Total Documents</p>
            <p className="text-2xl font-bold text-gray-900">1,284</p>
            <p className="text-xs text-green-600 mt-1">↑ 12% this month</p>
          </div>
        ),
      },
    ],
  },
  {
    name: 'Alerts',
    items: [
      {
        label: 'Info',
        preview: (
          <div className="w-72 bg-blue-50 border border-blue-200 rounded-md p-3">
            <p className="text-sm text-blue-800">This is an informational message.</p>
          </div>
        ),
      },
      {
        label: 'Error',
        preview: (
          <div className="w-72 bg-red-50 border border-red-200 rounded-md p-3">
            <p className="text-sm text-red-800">Something went wrong. Please try again.</p>
          </div>
        ),
      },
    ],
  },
]

function ComponentsPage(): React.ReactElement {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-6 py-12">
        <header className="mb-10">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Component Gallery</h1>
          <p className="text-lg text-gray-600">
            Explore the RevealUI component library — all built with Tailwind CSS v4.
          </p>
        </header>
        <div className="space-y-12">
          {COMPONENT_GROUPS.map((group) => (
            <section key={group.name}>
              <h2 className="text-xl font-semibold text-gray-800 mb-4 border-b border-gray-200 pb-2">
                {group.name}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {group.items.map(({ label, preview }) => (
                  <div key={label} className="bg-white rounded-lg border border-gray-200 p-6">
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-4">
                      {label}
                    </p>
                    <div className="flex items-center justify-center min-h-[60px]">{preview}</div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Examples Page
// ---------------------------------------------------------------------------

const EXAMPLES = [
  {
    title: 'Blog CMS',
    description:
      'A complete blog with posts, categories, tags, rich text editing, and SEO fields — powered by @revealui/core collections.',
    tags: ['Next.js', 'CMS', 'Lexical'],
    href: 'https://github.com/RevealUIStudio/revealui/tree/main/apps/cms',
  },
  {
    title: 'AI Agent Dashboard',
    description:
      'Real-time agent management UI with CRDT memory, LLM provider switching, and conversation history.',
    tags: ['@revealui/ai', 'ElectricSQL', 'Hono'],
    href: '/admin/monitoring',
  },
  {
    title: 'Visual Builder',
    description:
      'A drag-and-drop layout builder that generates RevealUI config from a visual canvas and deploys to Vercel.',
    tags: ['Builder', 'Vercel', 'Tailwind'],
    href: '/builder',
  },
  {
    title: 'Multi-tenant SaaS',
    description:
      'Enterprise multi-tenant setup with per-tenant collections, RBAC, and Stripe billing — built on RevealUI Pro.',
    tags: ['Enterprise', 'Stripe', 'Multi-tenant'],
    href: 'https://github.com/RevealUIStudio/revealui',
  },
]

function ExamplesPage(): React.ReactElement {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <header className="mb-10">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Examples</h1>
          <p className="text-lg text-gray-600">
            Real-world applications built with the RevealUI framework.
          </p>
        </header>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {EXAMPLES.map(({ title, description, tags, href }) => (
            <a
              key={title}
              href={href}
              target={href.startsWith('http') ? '_blank' : undefined}
              rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
              className="block bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow group"
            >
              <h2 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 mb-2 transition-colors">
                {title}
              </h2>
              <p className="text-sm text-gray-600 mb-4">{description}</p>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 rounded bg-gray-100 text-gray-600 text-xs font-medium"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Route table
// ---------------------------------------------------------------------------

export const routes: Route[] = [
  {
    path: '/',
    component: HomePage,
    meta: { title: 'RevealUI — Full-stack React Framework' },
  },
  {
    path: '/builder',
    component: BuilderPage,
    meta: { title: 'Visual Builder — RevealUI' },
  },
  {
    path: '/components',
    component: ComponentsPage,
    meta: { title: 'Component Gallery — RevealUI' },
  },
  {
    path: '/examples',
    component: ExamplesPage,
    meta: { title: 'Examples — RevealUI' },
  },
]
