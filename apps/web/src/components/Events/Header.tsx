import type React from 'react'

// Temporary component stubs until proper components are added to @revealui/presentation
interface ImageProps {
  src: string
  alt: string
  className?: string
}

const Image = ({ src, alt, className }: ImageProps) => (
  <img src={src} alt={alt} className={className} />
)

interface ContainerProps {
  children: React.ReactNode
  className?: string
  index?: number
}

const Container = ({ children, className }: ContainerProps) => (
  <div className={className}>{children}</div>
)

interface GridContainerProps {
  children: React.ReactNode
  className?: string
  index?: number
}

const GridContainer = ({ children, className }: GridContainerProps) => (
  <div className={className}>{children}</div>
)

const WelcomeHeading = () => (
  <div style={{ textAlign: 'center' }}>
    <h1 style={{ fontSize: '4rem', fontWeight: 'bold' }}>WELCOME</h1>
    <p style={{ fontSize: '1.5rem' }}>TO THE SCRAPYARD</p>
  </div>
)

const EventsHeader = (): React.ReactElement => {
  return (
    <GridContainer className="relative size-full h-screen" index={0}>
      <Container
        className="bg-scrapBlack/70 text-scrapOrange absolute z-50 mx-auto size-full place-content-center "
        index={0}
      >
        <WelcomeHeading />
      </Container>
      <Image
        src="https://res.cloudinary.com/dpytkhyme/image/upload/v1685928573/STREETBEEFS%20SCRAPYARD/scrapyard_event_june_wswkdz.jpg"
        alt=""
        className="shimmer bg-scrapBlack border-scrapBlack -z-50 aspect-[9/4] size-full h-screen rounded-sm border object-cover opacity-5 xl:rounded-3xl"
      />
    </GridContainer>
  )
}

export default EventsHeader
