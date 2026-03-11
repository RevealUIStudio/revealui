import type { RevealUIInstance } from '@revealui/core';

interface RevealUIWithLogin {
  login: (args: {
    collection: string;
    data: { email: string; password: string };
  }) => Promise<{ user: unknown; token: string }>; // token is an opaque session token
}

interface RequestWithLogin {
  user?: unknown;
  revealui?: RevealUIWithLogin | RevealUIInstance;
  data?: { password?: string };
}

export async function loginAfterCreate({
  doc,
  req,
  operation,
}: {
  doc: Record<string, unknown>;
  req: RequestWithLogin;
  operation: string;
}): Promise<Record<string, unknown>> {
  if (operation === 'create' && !req.user && req.revealui && 'login' in req.revealui) {
    const revealui = req.revealui as RevealUIWithLogin;

    // In RevealUI CMS 3.x, access body data from the doc itself
    const email = doc.email as string | undefined;
    const password = req.data?.password as string | undefined;

    if (email && password) {
      const { user, token } = await revealui.login({
        collection: 'users',
        data: { email, password },
      });

      return {
        ...doc,
        token,
        user,
      };
    }
  }

  return doc;
}
