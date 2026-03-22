// Minimal diagnostic route — zero external imports
// If this 500s, the issue is in Next.js server setup, not in RevealUI packages
export function GET() {
  return Response.json({
    ok: true,
    time: new Date().toISOString(),
    node: process.version,
    env: {
      NODE_ENV: process.env.NODE_ENV,
      POSTGRES_URL: process.env.POSTGRES_URL ? 'set' : 'missing',
      REVEALUI_SECRET: process.env.REVEALUI_SECRET ? 'set' : 'missing',
      NEXT_PUBLIC_SERVER_URL: process.env.NEXT_PUBLIC_SERVER_URL ?? 'missing',
      NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? 'missing',
      SKIP_ENV_VALIDATION: process.env.SKIP_ENV_VALIDATION ?? 'missing',
    },
  });
}
