// Temporary component stubs until proper components are added to @revealui/presentation
const UList = ({ items, type, className }: any) => {
  const Tag = type === 'ul' ? 'ul' : 'ol'
  return (
    <Tag className={className}>
      {items.map((item: any, idx: number) => (
        <li key={idx}>{item}</li>
      ))}
    </Tag>
  )
}

const Container = ({ children, className }: any) => (
  <div className={className}>{children}</div>
)

const Field = ({ children, className }: any) => (
  <div className={className}>{children}</div>
)

const FlexContainer = ({ children, className }: any) => (
  <div className={className}>{children}</div>
)

const Heading = ({ children, id, as = 'h1', className }: any) => {
  const Tag = as
  return <Tag id={id} className={className}>{children}</Tag>
}

const Paragraph = ({ children, className }: any) => (
  <p className={className}>{children}</p>
)

const VideoComponent = ({ url }: any) => (
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
