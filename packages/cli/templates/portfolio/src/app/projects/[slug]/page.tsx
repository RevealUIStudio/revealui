import Image from 'next/image';

const API_URL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:4000';

interface Project {
  id: string;
  title: string;
  slug: string;
  description: unknown;
  tags?: Array<{ tag: string }>;
  link?: string;
  image?: { url: string; alt?: string } | null;
}

async function getProject(slug: string): Promise<Project | null> {
  try {
    const res = await fetch(`${API_URL}/api/projects?where[slug][equals]=${slug}&limit=1`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.docs?.[0] ?? null;
  } catch {
    return null;
  }
}

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = await getProject(slug);

  if (!project) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16">
        <h1 className="text-2xl font-bold">Project not found</h1>
        <p className="mt-4">
          <a href="/projects" className="text-accent underline">
            Back to projects
          </a>
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <nav className="mb-8">
        <a href="/projects" className="text-sm text-accent underline">
          &larr; Back to projects
        </a>
      </nav>
      <article>
        {project.image?.url && (
          <Image
            src={project.image.url}
            alt={project.image.alt || project.title}
            width={800}
            height={450}
            className="mb-8 aspect-video w-full rounded-lg object-cover"
          />
        )}
        <h1 className="mb-2 text-3xl font-bold">{project.title}</h1>
        {project.tags && project.tags.length > 0 && (
          <div className="mb-6 flex flex-wrap gap-2">
            {project.tags.map((t) => (
              <span
                key={t.tag}
                className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700"
              >
                {t.tag}
              </span>
            ))}
          </div>
        )}
        <div className="prose">
          {typeof project.description === 'string' ? (
            <p>{project.description}</p>
          ) : (
            <p className="text-gray-500">Project description will render here.</p>
          )}
        </div>
        {project.link && (
          <a
            href={project.link}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 inline-block rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700"
          >
            View project &rarr;
          </a>
        )}
      </article>
    </main>
  );
}
