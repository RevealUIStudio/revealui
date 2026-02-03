// Temporary component stubs until proper components are added to @revealui/presentation
interface ImageProps {
  src: string
  alt: string
  className?: string
}

const Image = ({ src, alt, className }: ImageProps) => (
  <img src={src} alt={alt} className={className} />
)

interface DescriptionListProps {
  children?: React.ReactNode
  id?: string
  className?: string
  items?: unknown[]
}

const DescriptionList = ({ children, id, className, items }: DescriptionListProps) => (
  <dl id={id} className={className}>
    {children}
  </dl>
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

const FighterMain = (): React.ReactElement<{
  features: { id: string; name: string; description: string }[]
}> => {
  const features = [
    {
      id: '1',
      name: 'MMA',
      description: 'Combination of boxing, wrestling, Muay Thai, and other fighting styles',
    },
    {
      id: '2',
      name: 'Kickboxing',
      description:
        'Kickboxing is a stand-up combat sport that allows both punching and kicking techniques.',
    },
    {
      id: '3',
      name: 'Muay Thai',
      description:
        'Muay Thai is a combat sport from Thailand that uses stand-up striking along with various clinching techniques.',
    },
    {
      id: '4',
      name: 'Boxing',
      description:
        'Boxing is a combat sport in which two people, usually wearing protective gloves and other protective equipment such as hand wraps and mouthguards, throw punches at each other for a predetermined amount of time in a boxing ring.',
    },
    {
      id: '5',
      name: 'Jiu Jitsu',
      description:
        'Jiu Jitsu is a martial art and combat sport system that focuses on grappling and especially ground fighting.',
    },
  ]
  const scrapValues = [
    {
      name: 'MMA',
      description: 'Mixed Martial Arts',
      id: '6',
    },
    {
      name: 'Kickboxing',
      description: 'Kickboxing',
      id: '7',
    },
    {
      name: 'Muay Thai',
      description: 'Muay Thai',
      id: '8',
    },
    {
      name: 'Boxing',
      description: 'Boxing',
      id: '9',
    },
    {
      name: 'Jiu Jitsu',
      description: 'Jiu Jitsu',
      id: '10',
    },
  ]
  const featuresList = features?.map((feature) => (
    <Container key={feature?.name} className="relative">
      <Field className="text-scrapWhite  lg:text-scrapBlack inline-block font-bold leading-5 tracking-widest">
        <Paragraph className="text-4xl lg:text-3xl"> {feature?.name} </Paragraph>
      </Field>
    </Container>
  ))

  return (
    <Container className="place-content-center px-6 pt-28 lg:px-8">
      <GridContainer className=" grid max-w-2xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-6xl lg:grid-cols-2 lg:items-center lg:gap-y-5">
        <Field className="border-scrapRed relative isolate mx-auto overflow-hidden rounded-3xl border p-5 xl:px-24">
          <Heading
            id="fighter-main-heading"
            as={'h1'}
            className="text-scrapWhite text-3xl font-bold tracking-tight lg:text-5xl "
          >
            Scrapyard Styles
          </Heading>
          <Paragraph className="text-scrapWhite inline-flex py-4 text-lg leading-5 tracking-wide">
            We host fights from an array of fighting styles
          </Paragraph>

          <Image
            src="https://res.cloudinary.com/dpytkhyme/image/upload/v1693893297/STREETBEEFS%20SCRAPYARD/1_neflpd.svg"
            alt="firechicken fighter"
            className="relative -z-10 max-w-3xl rounded-xl shadow-xl ring-1 ring-white/10 lg:row-span-5 lg:row-start-3 lg:max-w-4xl"
          />
        </Field>

        <FlexContainer className="flex max-w-3xl flex-col items-center justify-center lg:row-start-5 lg:max-w-6xl lg:items-start ">
          <DescriptionList
            id="features-heading"
            className="max-w-4xl space-y-4 py-6 leading-5"
            items={scrapValues}
          >
            {featuresList}
          </DescriptionList>
        </FlexContainer>
      </GridContainer>
    </Container>
  )
}

export default FighterMain
