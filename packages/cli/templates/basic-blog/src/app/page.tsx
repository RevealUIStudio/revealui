export default function HomePage() {
  return (
    <main
      style={{
        fontFamily: 'sans-serif',
        maxWidth: '640px',
        margin: '4rem auto',
        padding: '0 1rem',
      }}
    >
      <h1>Welcome to RevealUI</h1>
      <p>
        Your CMS is running. Visit <a href="/admin">/admin</a> to access the admin panel.
      </p>
      <p style={{ color: '#666', fontSize: '0.875rem' }}>
        Edit <code>src/app/page.tsx</code> to customise this page.
      </p>
    </main>
  )
}
