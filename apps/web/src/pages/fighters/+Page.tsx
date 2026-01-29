import type React from 'react'
import {
  FightersBackground,
  // FightersCard,
  // FightersContent,
  FightersHeader,
  FightersHero,
  // FightersMain,
  FightersSection,
} from '../../components/Fighters/index.js'

export { Page }

function Page(): React.ReactElement {
  return (
    <FightersBackground index={0}>
      <FightersHeader />
      <FightersHero />
      <FightersSection />
      {/* <FightersCard /> */}
      {/* <FightersMain /> */}
      {/* <FightersContent /> */}
    </FightersBackground>
  )
}
