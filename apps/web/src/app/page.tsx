import { Builder } from '../components/Builder'

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">RevealUI Builder</h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-6">
            Create beautiful applications without coding. Drag, drop, and deploy to Vercel
            instantly.
          </p>
        </header>

        <Builder />
      </div>
    </main>
  )
}
