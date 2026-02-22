// Bare test page — zero workspace imports
// If this returns 200, the framework works and the issue is in page imports

export const dynamic = 'force-dynamic'

export default function DebugPage() {
  return (
    <div style={{ padding: '20px', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Debug Page</h1>
      <p>If you see this, Next.js routing works on Vercel.</p>
      <p>
        Node: {process.version} | Env: {process.env.NODE_ENV} | Vercel:{' '}
        {process.env.VERCEL ? 'yes' : 'no'}
      </p>
      <p>
        POSTGRES_URL: {process.env.POSTGRES_URL ? 'set' : 'NOT SET'} | DATABASE_URL:{' '}
        {process.env.DATABASE_URL ? 'set' : 'NOT SET'}
      </p>
      <p>
        REVEALUI_SECRET: {process.env.REVEALUI_SECRET ? 'set' : 'NOT SET'} | SERVER_URL:{' '}
        {process.env.NEXT_PUBLIC_SERVER_URL || 'NOT SET'}
      </p>
    </div>
  )
}
