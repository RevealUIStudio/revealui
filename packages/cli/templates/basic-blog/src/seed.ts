/**
 * Seed script for the basic-blog template.
 * Creates 3 sample blog posts via the RevealUI REST API.
 *
 * Usage: pnpm db:seed (requires the dev server to be running)
 */

const API_URL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:4000';

interface SeedPost {
  title: string;
  slug: string;
  content: string;
  status: string;
  publishedAt: string;
}

const posts: SeedPost[] = [
  {
    title: 'Getting Started with RevealUI',
    slug: 'getting-started-with-revealui',
    content:
      'Welcome to your new RevealUI blog! This post was created by the seed script. Edit or delete it from the admin panel at /admin.',
    status: 'published',
    publishedAt: new Date().toISOString(),
  },
  {
    title: 'Customizing Your Blog',
    slug: 'customizing-your-blog',
    content:
      'You can customize your blog by editing the Posts collection in src/collections/Posts.ts. Add new fields, change validation rules, or add hooks to run custom logic.',
    status: 'published',
    publishedAt: new Date(Date.now() - 86_400_000).toISOString(),
  },
  {
    title: 'Draft Post Example',
    slug: 'draft-post-example',
    content:
      'This is a draft post. It will not appear on the public blog until you change its status to "published" in the admin panel.',
    status: 'draft',
    publishedAt: '',
  },
];

const log = (...args: unknown[]) => process.stdout.write(`${args.join(' ')}\n`);
const logErr = (...args: unknown[]) => process.stderr.write(`${args.join(' ')}\n`);

async function seed(): Promise<void> {
  log(`Seeding blog posts to ${API_URL}...`);

  for (const post of posts) {
    try {
      const res = await fetch(`${API_URL}/api/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(post),
      });

      if (res.ok) {
        log(`  Created: ${post.title}`);
      } else {
        const error = await res.text();
        logErr(`  Failed to create "${post.title}": ${error}`);
      }
    } catch (err) {
      logErr(`  Error creating "${post.title}":`, err);
    }
  }

  log('Seeding complete.');
}

seed();
