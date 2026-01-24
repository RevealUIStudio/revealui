import { ParallaxComponent } from 'revealui/ui/accents'
import { BackgroundWrapper, GradientGlass, GradientToBottom, Solid } from 'revealui/ui/backgrounds'

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
