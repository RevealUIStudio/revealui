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

const BackgroundWrapper = ({ children, backgrounds }: any) => (
  <div style={{ position: 'relative' }}>
    {backgrounds}
    {children}
  </div>
)

const Container = ({ children, className, index }: any) => (
  <div className={className}>{children}</div>
)

const AboutBackground = ({ children }: { children: React.ReactNode }, index?: number) => {
  return (
    <>
      <ParallaxComponent maxWidth={'none'} blendMode={'normal'} negativeIndex={1}>
        <Solid color="black" darkColor="orange" negativeIndex={50} />
      </ParallaxComponent>
      <Container className="bg-scrapBlack isolate overflow-hidden" index={0}>
        <BackgroundWrapper backgrounds={[<Solid key={index} negativeIndex={50} />]}>
          {children}
        </BackgroundWrapper>
      </Container>
    </>
  )
}

export default AboutBackground
