import type React from 'react'

// Temporary component stubs until proper components are added to @revealui/presentation
interface ImageProps {
  src: string
  alt: string
  className?: string
  loading?: 'eager' | 'lazy'
}

const Image = ({ src, alt, className, loading }: ImageProps) => (
  <img src={src} alt={alt} className={className} loading={loading} />
)

interface Slide {
  id: number
  url: string
  alt: string
}

interface CarouselProps {
  slides: Slide[]
}

const Carousel = ({ slides }: CarouselProps) => (
  <div style={{ display: 'flex', overflow: 'auto', gap: '1rem' }}>
    {slides.map((slide: Slide) => (
      <img
        key={slide.id}
        src={slide.url}
        alt={slide.alt}
        style={{ width: '300px', height: 'auto' }}
      />
    ))}
  </div>
)

interface ContainerProps {
  children: React.ReactNode
  className?: string
}

const Container = ({ children, className }: ContainerProps) => (
  <div className={className}>{children}</div>
)

interface FieldProps {
  children?: React.ReactNode
  className?: string
}

const Field = ({ children, className }: FieldProps) => <div className={className}>{children}</div>

interface FlexContainerProps {
  children: React.ReactNode
  className?: string
}

const FlexContainer = ({ children, className }: FlexContainerProps) => (
  <div className={className}>{children}</div>
)

interface GridContainerProps {
  children: React.ReactNode
  className?: string
}

const GridContainer = ({ children, className }: GridContainerProps) => (
  <div className={className}>{children}</div>
)

interface HeadingProps {
  children: React.ReactNode
  id?: string
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
  className?: string
}

const Heading = ({ children, id, as = 'h2', className }: HeadingProps) => {
  const Tag = as
  return (
    <Tag id={id} className={className}>
      {children}
    </Tag>
  )
}

const EventsHero = (): React.ReactElement => {
  const slides = [
    {
      id: 1,
      url: 'https://res.cloudinary.com/dpytkhyme/image/upload/v1686377849/STREETBEEFS%20SCRAPYARD/received_1700967013600120_u4r0rm.jpg',
      alt: 'Fighter',
    },
    {
      id: 2,
      url: 'https://res.cloudinary.com/dpytkhyme/image/upload/v1686377848/STREETBEEFS%20SCRAPYARD/received_752359863229832_oisr2p.jpg',
      alt: 'Fighter',
    },
    {
      id: 3,
      url: 'https://res.cloudinary.com/dpytkhyme/image/upload/v1686377851/STREETBEEFS%20SCRAPYARD/received_428354212790734_ak0tyr.jpg',
      alt: 'Fighter',
    },

    {
      id: 4,
      url: 'https://res.cloudinary.com/dpytkhyme/image/upload/v1686377849/STREETBEEFS%20SCRAPYARD/FB_IMG_1625347456800_lyyse8.jpg',
      alt: 'Fighter',
    },
    {
      id: 5,
      url: 'https://res.cloudinary.com/dpytkhyme/image/upload/v1686377850/STREETBEEFS%20SCRAPYARD/received_1868826103304521_g7kgk4.jpg',
      alt: 'Fighter',
    },
    {
      id: 6,
      url: 'https://res.cloudinary.com/dpytkhyme/image/upload/v1686377850/STREETBEEFS%20SCRAPYARD/received_447397920602851_a3vpi7.jpg',
      alt: 'Fighter',
    },
    {
      id: 7,
      url: 'https://res.cloudinary.com/dpytkhyme/image/upload/v1686377853/STREETBEEFS%20SCRAPYARD/FB_IMG_1681669127123_fhvy8y.jpg',
      alt: 'Fighter',
    },
    {
      id: 8,
      url: 'https://res.cloudinary.com/dpytkhyme/image/upload/v1687111690/STREETBEEFS%20SCRAPYARD/FB_IMG_1616984302832_jscuae.jpg',
      alt: 'Fighter',
    },
  ]
  return (
    <Container className="relative isolate z-10 my-10 ">
      <GridContainer className="grid-cols-1 md:grid-cols-2">
        <Field className="relative">
          <Image
            src="https://res.cloudinary.com/dpytkhyme/image/upload/v1691668058/STREETBEEFS%20SCRAPYARD/website%20new/non%20fight%20pictures/FB_IMG_1629559008575_j8vjuq.jpg"
            alt="Buddy V at the Scrapyard"
            loading="eager"
          />
        </Field>
        <Field className="relative">
          <Image
            src="https://res.cloudinary.com/dpytkhyme/image/upload/v1687111691/STREETBEEFS%20SCRAPYARD/FB_IMG_1650861113653_ddjrv5.jpg"
            alt="Fighter"
            loading="eager"
          />
        </Field>
        <FlexContainer className="relative mx-auto w-full flex-col items-center justify-center gap-1 ">
          <Field className="static mx-auto place-content-center text-center ">
            <Heading
              id="events-hero-heading"
              as={'h2'}
              className="prose-h2 text-scrapYellow xl:text-10xl mx-auto w-full max-w-sm place-content-center text-5xl font-extrabold tracking-widest lg:max-w-2xl lg:text-9xl"
            >
              Monthly Events
            </Heading>
          </Field>
        </FlexContainer>
        <Carousel slides={slides} />
      </GridContainer>
    </Container>
  )
}

export default EventsHero
