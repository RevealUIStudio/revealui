import type React from 'react'

// Temporary component stubs until proper components are added to @revealui/presentation
const ParallaxComponent = ({ children, maxWidth, blendMode, negativeIndex }: any) => (
  <div style={{ maxWidth, mixBlendMode: blendMode, zIndex: negativeIndex ? -negativeIndex : undefined }}>
    {children}
  </div>
)

const Solid = ({ color, darkColor, negativeIndex }: any) => (
  <div
    style={{
      backgroundColor: color,
      zIndex: negativeIndex ? -negativeIndex : undefined,
      position: 'absolute',
      inset: 0
    }}
  />
)

const GradientConic = ({ gradientStops }: any) => (
  <div
    style={{
      background: 'conic-gradient(from 180deg, #f59e0b, #3b82f6, #f59e0b)',
      position: 'absolute',
      inset: 0
    }}
  />
)

const GradientConicRev = ({ className }: any) => (
  <div
    className={className}
    style={{
      background: 'conic-gradient(from 0deg, #3b82f6, #f59e0b, #3b82f6)',
      position: 'absolute',
      inset: 0
    }}
  />
)

const GradientToBottom = ({ className }: any) => (
  <div
    className={className}
    style={{
      background: 'linear-gradient(to bottom, transparent, rgba(0,0,0,0.8))',
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

const Container = ({ children, className, index }: any) => (
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
