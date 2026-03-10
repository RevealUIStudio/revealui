import Image from 'next/image'

const API_URL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:4000'

interface Project {
  id: string
  title: string
  slug: string
  description: unknown
  tags?: Array<{ tag: string }>
  link?: string
  image?: { url: string; alt?: string } | null
}

async function getProjects(): Promise<Project[]> {
  try {
    const res = await fetch(`${API_URL}/api/projects?sort=-createdAt`, {
      cache: 'no-store',
    })
    if (!res.ok) return []
    const data = await res.json()
    return data.docs ?? []
  } catch {
    return []
  }
}

export default async function ProjectsPage() {
  const projects = await getProjects()

  return (
    <main className="mx-auto max-w-4xl px-4 py-16">
      <h1 className="mb-8 text-3xl font-bold">Projects</h1>

      {projects.length === 0 ? (
        <p className="text-gray-500">
          No projects yet. Add projects in the{' '}
          <a href="/admin/collections/projects" className="text-accent underline">
            admin panel
          </a>
          , or run <code className="rounded bg-gray-100 px-1">pnpm db:seed</code> to add sample
          data.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {projects.map((project) => (
            <div
              key={project.id}
              className="rounded-lg border border-gray-200 p-4 transition-shadow hover:shadow-md"
            >
              {project.image?.url && (
                <Image
                  src={project.image.url}
                  alt={project.image.alt || project.title}
                  width={600}
                  height={338}
                  className="mb-4 aspect-video w-full rounded object-cover"
                />
              )}
              <h2 className="text-xl font-semibold">{project.title}</h2>
              {project.tags && project.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {project.tags.map((t) => (
                    <span
                      key={t.tag}
                      className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700"
                    >
                      {t.tag}
                    </span>
                  ))}
                </div>
              )}
              {project.link && (
                <a
                  href={project.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-block text-sm text-accent underline"
                >
                  View project &rarr;
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
