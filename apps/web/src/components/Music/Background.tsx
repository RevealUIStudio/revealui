import type React from 'react'

// Temporary component replacements until proper components are added to @revealui/presentation
interface ParallaxComponentProps {
  children: React.ReactNode
  maxWidth: string
  blendMode: string
  negativeIndex?: number
}

const ParallaxComponent = ({ children, maxWidth, blendMode, negativeIndex }: ParallaxComponentProps) => (
  <div style={{ maxWidth, mixBlendMode: blendMode, zIndex: negativeIndex ? -negativeIndex : undefined }}>
    {children}
  </div>
)

interface SolidProps {
  color: string
  darkColor?: string
  negativeIndex?: number
  className?: string
}

const Solid = ({ color, darkColor, negativeIndex, className }: SolidProps) => (
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

interface BackgroundWrapperProps {
  children: React.ReactNode
  backgrounds: React.ReactNode
}

const BackgroundWrapper = ({ children, backgrounds }: BackgroundWrapperProps) => (
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
