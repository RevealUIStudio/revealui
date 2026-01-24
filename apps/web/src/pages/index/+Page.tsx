// import {Container} from "revealui/ui/shells";
import React from 'react'
import { Builder } from '../../components/Builder/Builder'
import {
  HomeBackground,
  HomeCard,
  HomeContent,
  HomeHeader,
  HomeHero,
  HomeMain,
  HomeSection,
} from '../../components/Home'

export { Page }

function Page(): React.ReactElement {
  const [showBuilder, setShowBuilder] = React.useState(false)

  if (showBuilder) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          <header className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">RevealUI Builder</h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-6">
              Create beautiful applications without coding. Drag, drop, and deploy to Vercel
              instantly.
            </p>
            <button
              onClick={() => setShowBuilder(false)}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              ← Back to Home
            </button>
          </header>
          <Builder />
        </div>
      </div>
    )
  }

  return (
    <HomeBackground>
      {/* <Container className="relative isolate z-10"> */}
      <HomeHeader />

      <div className="text-center mb-8">
        <button
          onClick={() => setShowBuilder(true)}
          className="px-8 py-4 bg-blue-600 text-white text-xl font-bold rounded-lg hover:bg-blue-700 transition-colors"
        >
          🚀 Try the Visual Builder
        </button>
      </div>

      <HomeCard />

      <HomeSection />

      <HomeMain />

      <HomeHero />

      <HomeContent />
      {/* </Container> */}
    </HomeBackground>
  )
}
