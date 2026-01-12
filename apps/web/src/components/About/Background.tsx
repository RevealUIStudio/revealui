import { ParallaxComponent } from 'revealui/ui/accents'
import { BackgroundWrapper, Solid } from 'revealui/ui/backgrounds'
import { Container } from 'revealui/ui/shells'

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
