import type React from 'react'

// Temporary component replacements until proper components are added to @revealui/presentation
const ParallaxComponent = ({ children, maxWidth, blendMode, negativeIndex }: any) => (
  <div style={{ maxWidth, mixBlendMode: blendMode, zIndex: negativeIndex ? -negativeIndex : undefined }}>
    {children}
  </div>
)

const Solid = ({ color, darkColor, negativeIndex, className }: any) => (
  <div
    className={className}
    style={{
      backgroundColor: color,
      zIndex: negativeIndex ? -negativeIndex : undefined,
      position: 'absolute',
      inset: 0
    }}
  />
)

const BackgroundWrapper = ({ children, backgrounds }: any) => (
  <div style={{ position: 'relative' }}>
    {backgrounds}
    {children}
  </div>
)

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
