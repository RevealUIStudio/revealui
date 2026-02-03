// Temporary component stubs until proper components are added to @revealui/presentation
interface ParallaxComponentProps {
  children: React.ReactNode
  maxWidth: string
  blendMode: React.CSSProperties['mixBlendMode']
  negativeIndex?: number
}

const ParallaxComponent = ({
  children,
  maxWidth,
  blendMode,
  negativeIndex,
}: ParallaxComponentProps) => (
  <div
    style={{
      maxWidth,
      mixBlendMode: blendMode,
      zIndex: negativeIndex ? -negativeIndex : undefined,
    }}
  >
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
      inset: 0,
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

const AboutBackground = ({ children }: { children: React.ReactNode }, index?: number) => {
  return (
    <>
      <ParallaxComponent maxWidth={'none'} blendMode={'normal'} negativeIndex={1}>
        <Solid color="black" darkColor="orange" negativeIndex={50} />
      </ParallaxComponent>
      <Container className="bg-scrapBlack isolate overflow-hidden" index={0}>
        <BackgroundWrapper backgrounds={[<Solid key={index} color="black" negativeIndex={50} />]}>
          {children}
        </BackgroundWrapper>
      </Container>
    </>
  )
}

export default AboutBackground
