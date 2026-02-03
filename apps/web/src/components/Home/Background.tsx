import type React from 'react'

// Temporary component stubs until proper components are added to @revealui/presentation
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
  opacity?: number
  className?: string
}

const Solid = ({ color, darkColor, negativeIndex, opacity, className }: SolidProps) => (
  <div
    className={className}
    style={{
      backgroundColor: color,
      opacity: opacity ? opacity / 100 : 1,
      zIndex: negativeIndex ? -negativeIndex : undefined,
      position: 'absolute',
      inset: 0
    }}
  />
)

interface GradientGlassProps {
  indexClass: number
  id: string
}

const GradientGlass = ({ indexClass, id }: GradientGlassProps) => (
  <div
    id={id}
    className={`-z-${indexClass}`}
    style={{
      background: 'linear-gradient(to bottom, rgba(255,255,255,0.1), rgba(255,255,255,0.05))',
      backdropFilter: 'blur(10px)',
      position: 'absolute',
      inset: 0
    }}
  />
)

interface GradientToBottomProps {
  maxWidth: string
  blendMode: string
  negativeIndex?: number
}

const GradientToBottom = ({ maxWidth, blendMode, negativeIndex }: GradientToBottomProps) => (
  <div
    style={{
      maxWidth,
      mixBlendMode: blendMode,
      zIndex: negativeIndex ? -negativeIndex : undefined,
      background: 'linear-gradient(to bottom, transparent, rgba(0,0,0,0.8))',
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

const HomeBackground = ({ children }: { children: React.ReactNode }) => {
  return (
    <>
      <ParallaxComponent maxWidth={'none'} blendMode={'screen'} negativeIndex={50}>
        <Solid key={'solid'} color="yellow" darkColor="orange" negativeIndex={50} />
      </ParallaxComponent>
      <BackgroundWrapper
        backgrounds={[
          <GradientGlass key="glass" indexClass={50} id={'glass-background'} />,
          <Solid key="solid" darkColor="black" color="black" negativeIndex={15} opacity={80} />,
          <GradientToBottom
            key="gradientBottom"
            maxWidth="none"
            blendMode="screen"
            negativeIndex={40}
          />,
        ]}
      >
        {children}
      </BackgroundWrapper>
    </>
  )
}

export default HomeBackground
