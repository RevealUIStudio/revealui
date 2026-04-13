/**
 * Suite-wide bootstrap primitive for RevealUI.
 *
 * Creates the first admin user and seeds minimal content.
 * Designed for three consumers (in priority order):
 *   1. Agents / MCP clients (programmatic)
 *   2. CLI (`pnpm admin:setup`)
 *   3. Browser UI (`/setup` page)
 *
 * Self-disabling: refuses to run if any users already exist.
 * The RevealUI instance is injected  -  this module has no direct
 * dependency on @revealui/core or @revealui/db, keeping the
 * setup package lightweight.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Minimal interface for the RevealUI admin instance (injected by consumer). */
export interface RevealUILike {
  find: (args: {
    collection: string;
    limit?: number;
    depth?: number;
    where?: Record<string, unknown>;
  }) => Promise<{ totalDocs: number; docs: Array<Record<string, unknown>> }>;
  create: (args: {
    collection: string;
    data: Record<string, unknown>;
  }) => Promise<Record<string, unknown>>;
}

export interface BootstrapAdminConfig {
  email: string;
  password: string;
  name?: string;
}

export interface BootstrapOptions {
  /** RevealUI admin instance (injected  -  keeps setup package lightweight). */
  revealui: RevealUILike;
  /** First admin user credentials. */
  admin: BootstrapAdminConfig;
  /** Seed minimal content (home page). Default: true. */
  seed?: boolean;
}

export interface BootstrapResult {
  status: 'created' | 'locked' | 'error';
  message: string;
  user?: { email: string; role: string };
  seeded?: boolean;
  error?: string;
}

// ---------------------------------------------------------------------------
// Seed data (minimal  -  just enough to make the app functional)
// ---------------------------------------------------------------------------

function richTextDoc(...nodes: unknown[]) {
  return {
    root: {
      type: 'root',
      children: nodes,
      direction: 'ltr',
      format: '',
      indent: 0,
      version: 1,
    },
  };
}

function heading(text: string, tag: 'h2' | 'h3' | 'h4' = 'h2') {
  return {
    type: 'heading',
    children: [{ type: 'text', detail: 0, format: 0, mode: 'normal', style: '', text, version: 1 }],
    direction: 'ltr',
    format: '',
    indent: 0,
    tag,
    version: 1,
  };
}

function paragraph(text: string) {
  return {
    type: 'paragraph',
    children: [{ type: 'text', detail: 0, format: 0, mode: 'normal', style: '', text, version: 1 }],
    direction: 'ltr',
    format: '',
    indent: 0,
    textFormat: 0,
    textStyle: '',
    version: 1,
  };
}

const SEED_PAGES = [
  {
    title: 'Home',
    slug: 'home',
    path: '/',
    layout: [
      {
        blockType: 'content',
        columns: [
          {
            size: 'full',
            richText: richTextDoc(
              heading('Welcome to RevealUI'),
              paragraph(
                'Your agentic business runtime is ready. Visit /admin to manage content, configure collections, and build your application.',
              ),
            ),
          },
        ],
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

/**
 * Bootstrap a fresh RevealUI instance.
 *
 * 1. Checks if any users exist (self-disabling gate)
 * 2. Validates admin credentials
 * 3. Creates the first admin user
 * 4. Seeds minimal content (home page) if requested
 *
 * @returns BootstrapResult with status, message, and optional user/seed info.
 */
export async function bootstrap(options: BootstrapOptions): Promise<BootstrapResult> {
  const { revealui, admin, seed = true } = options;

  // Self-disabling gate: refuse if any users exist
  try {
    const existing = await revealui.find({
      collection: 'users',
      limit: 1,
      depth: 0,
    });

    if (existing.totalDocs > 0) {
      return {
        status: 'locked',
        message: 'Setup already completed. Users exist.',
      };
    }
  } catch (err) {
    return {
      status: 'error',
      message: 'Database connection failed. Check POSTGRES_URL or DATABASE_URL.',
      error: err instanceof Error ? err.message : String(err),
    };
  }

  // Validate credentials
  if (!(admin.email && admin.password)) {
    return {
      status: 'error',
      message: 'Admin email and password are required.',
    };
  }

  if (admin.password.length < 12) {
    return {
      status: 'error',
      message: 'Admin password must be at least 12 characters.',
    };
  }

  // Create the first admin user.
  // Dual-role write: the DB `role` column uses the Drizzle enum
  // (owner/admin/editor/viewer/agent/contributor, enforced by CHECK constraint)
  // while the Payload `roles` array uses the application taxonomy
  // (super-admin/admin). Both layers consume different fields;
  // first user is 'owner' at the DB layer and 'super-admin' at the app layer.
  try {
    await revealui.create({
      collection: 'users',
      data: {
        name: admin.name ?? 'Admin',
        email: admin.email,
        password: admin.password,
        role: 'owner',
        roles: ['super-admin'],
      },
    });
  } catch (err) {
    const pgCode = (err as { code?: string }).code;
    if (pgCode === '23505') {
      return {
        status: 'error',
        message: 'A user with that email already exists.',
      };
    }
    return {
      status: 'error',
      message: 'Failed to create admin user.',
      error: err instanceof Error ? err.message : String(err),
    };
  }

  // Seed minimal content
  let seeded = false;
  if (seed) {
    try {
      for (const page of SEED_PAGES) {
        const existing = await revealui.find({
          collection: 'pages',
          where: { slug: { equals: page.slug } } as never,
          limit: 1,
        });

        if (existing.docs.length === 0) {
          await revealui.create({
            collection: 'pages',
            data: page as never,
          });
        }
      }
      seeded = true;
    } catch {
      // Non-fatal  -  user was created, seed can be retried via pnpm db:seed
    }
  }

  return {
    status: 'created',
    message: `Admin user created${seeded ? ' and content seeded' : ''}. Sign in at /admin.`,
    user: { email: admin.email, role: 'owner' },
    seeded,
  };
}
