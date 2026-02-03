import type React from 'react'

// Temporary component stubs until proper components are added to @revealui/presentation
interface ParallaxComponentProps {
  children: React.ReactNode
  maxWidth: string
  blendMode: React.CSSProperties['mixBlendMode']
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
}

const Solid = ({ color, darkColor, negativeIndex }: SolidProps) => (
  <div
    style={{
      backgroundColor: color,
      zIndex: negativeIndex ? -negativeIndex : undefined,
      position: 'absolute',
      inset: 0
    }}
  />
)

interface GradientConicProps {
  gradientStops?: string
}

const GradientConic = ({ gradientStops }: GradientConicProps) => (
  <div
    style={{
      background: 'conic-gradient(from 180deg, #f59e0b, #3b82f6, #f59e0b)',
      position: 'absolute',
      inset: 0
    }}
  />
)

interface GradientConicRevProps {
  className?: string
}

const GradientConicRev = ({ className }: GradientConicRevProps) => (
  <div
    className={className}
    style={{
      background: 'conic-gradient(from 0deg, #3b82f6, #f59e0b, #3b82f6)',
      position: 'absolute',
      inset: 0
    }}
  />
)

interface GradientToBottomProps {
  className?: string
}

const GradientToBottom = ({ className }: GradientToBottomProps) => (
  <div
    className={className}
    style={{
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

interface ContainerProps {
  children: React.ReactNode
  className?: string
  index?: number
}

const Container = ({ children, className, index }: ContainerProps) => (
  <div className={className}>{children}</div>
)

const EventsBackground = ({ children }: { children: React.ReactNode }, index?: number) => {
  return (
    <>
      <ParallaxComponent maxWidth={'none'} blendMode={'normal'} negativeIndex={1}>
        <Solid key={index} color="yellow" darkColor="orange" negativeIndex={40} />
      </ParallaxComponent>
      <Container className="overflow-hidden" index={0}>
        <BackgroundWrapper
          backgrounds={[
            <GradientConic gradientStops={'from-inherit'} key="conic" />,
            <GradientToBottom key="gradient" className="z-20" />,
            <GradientConicRev key="conicRev" className="z-30" />,
          ]}
        >
          {children}
        </BackgroundWrapper>
      </Container>
    </>
  )
}

export default EventsBackground
