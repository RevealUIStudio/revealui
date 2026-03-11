import type { RevealDocument, RevealRequest, RevealUIInstance } from '@revealui/core';

interface RequestWithRevealUI extends Omit<RevealRequest, 'headers'> {
  revealui?: RevealUIInstance;
  headers?: Headers | Map<string, string> | Record<string, string>;
}

interface UserWithId extends RevealDocument {
  id: string | number;
}

export async function recordLastLoggedInTenant({
  req,
  user,
}: {
  req: RequestWithRevealUI;
  user: UserWithId;
}): Promise<UserWithId> {
  if (!req.revealui) {
    return user;
  }

  try {
    const host =
      typeof req.headers === 'object' && req.headers !== null
        ? 'get' in req.headers
          ? (req.headers as Headers).get('host')
          : (req.headers as Record<string, string>).host
        : undefined;

    if (!host) {
      return user;
    }

    const result = await req.revealui.find({
      collection: 'tenants',
      where: {
        'domains.domain': {
          in: [host],
        },
      },
      depth: 0,
      limit: 1,
    });

    const relatedOrg = result.docs?.[0] as RevealDocument | undefined;

    await req.revealui.update({
      id: user.id,
      collection: 'users',
      data: {
        lastLoggedInTenant: relatedOrg?.id || null,
      },
      req: req as RevealRequest,
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    req.revealui?.logger?.error(
      `Error recording last logged in tenant for user ${user.id}: ${errorMessage}`,
    );
  }

  return user;
}
