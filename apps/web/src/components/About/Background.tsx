import { ParallaxComponent } from "reveal/ui/accents";
import { Solid, BackgroundWrapper } from "reveal/ui/backgrounds";
import { Container } from "reveal/ui/shells";

const AboutBackground = (
  { children }: { children: React.ReactNode },
  index?: number,
) => {
  return (
    <>
      <ParallaxComponent
        maxWidth={"none"}
        blendMode={"normal"}
        negativeIndex={1}
      >
        <Solid color="black" darkColor="orange" negativeIndex={50} />
      </ParallaxComponent>
      <Container className="bg-scrapBlack isolate overflow-hidden" index={0}>
        <BackgroundWrapper
          backgrounds={[<Solid key={index} negativeIndex={50} />]}
        >
          {children}
        </BackgroundWrapper>
      </Container>
    </>
  );
};

export default AboutBackground;
