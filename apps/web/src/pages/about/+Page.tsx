import type React from 'react'
import {
  AboutBackground,
  AboutCard,
  AboutContent,
  AboutHeader,
  AboutHero,
  AboutMain,
  AboutSection,
} from '../../components/About/index.js'

export { Page }

function Page(): React.ReactElement {
  return (
    <AboutBackground>
      <AboutHeader />
      <AboutHero />
      <AboutMain />
      <AboutSection />
      <AboutContent />
      <AboutCard />
    </AboutBackground>
  )
}
