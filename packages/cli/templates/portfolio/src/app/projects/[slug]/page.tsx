import { Heading, LinkButton, Text } from '@revealui/presentation';
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
        <Heading>Project not found</Heading>
        <Text className="mt-4">
          <LinkButton href="/projects" appearance="link" size="sm">
            Back to projects
          </LinkButton>
        </Text>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <nav className="mb-8">
        <LinkButton href="/projects" appearance="link" size="sm">
          Back to projects
        </LinkButton>
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
        <Heading className="mb-2">{project.title}</Heading>
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
            <Text>{project.description}</Text>
          ) : (
            <Text className="text-gray-500">Project description will render here.</Text>
          )}
        </div>
        {project.link && (
          <div className="mt-8">
            <LinkButton href={project.link} external variant="neutral">
              View project
            </LinkButton>
          </div>
        )}
      </article>
    </main>
  );
}
