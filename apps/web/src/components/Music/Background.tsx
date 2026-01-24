import type React from 'react'
import { ParallaxComponent } from 'revealui/ui/accents'
import { BackgroundWrapper, Solid } from 'revealui/ui/backgrounds'

const MusicBackground = ({ children }: { children: React.ReactNode }, index?: number) => {
  return (
    <>
      <ParallaxComponent maxWidth={'none'} blendMode={'normal'} negativeIndex={1}>
        <Solid key={index} color="black" darkColor="red" negativeIndex={40} />
      </ParallaxComponent>
      <BackgroundWrapper backgrounds={[<Solid key="solid" color="scrapBlack" className="-z-50" />]}>
        {children}
      </BackgroundWrapper>
    </>
  )
}

export default MusicBackground
