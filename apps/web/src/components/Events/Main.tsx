// Temporary component stubs until proper components are added to @revealui/presentation
interface UListProps {
  items: React.ReactNode[]
  type?: 'ul' | 'ol'
  className?: string
}

const UList = ({ items, type, className }: UListProps) => {
  const Tag = type === 'ul' ? 'ul' : 'ol'
  return (
    <Tag className={className}>
      {items.map((item: React.ReactNode, idx: number) => (
        <li key={idx}>{item}</li>
      ))}
    </Tag>
  )
}

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

interface HeadingProps {
  children: React.ReactNode
  id?: string
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
  className?: string
}

const Heading = ({ children, id, as = 'h1', className }: HeadingProps) => {
  const Tag = as
  return (
    <Tag id={id} className={className}>
      {children}
    </Tag>
  )
}

interface ParagraphProps {
  children: React.ReactNode
  className?: string
}

const Paragraph = ({ children, className }: ParagraphProps) => (
  <p className={className}>{children}</p>
)

interface VideoComponentProps {
  url: string
}

const VideoComponent = ({ url }: VideoComponentProps) => (
  <video src={url} controls style={{ width: '100%', height: 'auto' }} />
)

const EventsMain = () => {
  const initialData = {
    heading: 'Check out the latest fight here',
    paragraph: 'There is always gauranteed entertainment with Streetbeefs Scrapyard!',
  }
  const benefits = [
    'Guns Down Gloves Up',
    'Find out who you are',
    'Live life confidently',
    'Be humble',
    'Find your purpose',
    'Great Sportsmanship',
  ]
  const EventsParagraph = () => {
    return (
      <Field className="relative z-50 mx-auto size-full">
        <Paragraph className="text-scrapBlack z-50 text-xl font-semibold tracking-normal">
          {initialData.paragraph}
        </Paragraph>
      </Field>
    )
  }

  const EventsHeading = () => {
    return (
      <Field className="relative z-50 mx-auto size-full">
        <Heading
          as={'h1'}
          id="events-main-heading"
          className="prose-h1 text-scrapBlack z-50 text-4xl font-extrabold tracking-widest "
        >
          {initialData.heading}
        </Heading>
      </Field>
    )
  }

  return (
    <Container className="relative isolate z-10 ">
      <FlexContainer className=" flex-col gap-6 rounded-3xl px-5 py-10 lg:mx-auto lg:max-w-7xl lg:flex-row lg:items-center lg:justify-center lg:py-20 xl:max-w-none xl:gap-x-20 xl:px-20">
        <Field className="relative z-50 mx-auto size-full">
          <VideoComponent
            url={
              'https://res.cloudinary.com/dpytkhyme/video/upload/v1699245373/STREETBEEFS%20SCRAPYARD/glitch_intro_pd6o91.mp4'
            }
          />
        </Field>

        <Field className="mx-auto size-full">
          <EventsHeading />
          <EventsParagraph />
          <UList
            type="ul"
            className="text-scrapBlack z-50 text-xl font-normal tracking-normal"
            items={benefits}
          />
        </Field>
      </FlexContainer>
    </Container>
  )
}

export default EventsMain
