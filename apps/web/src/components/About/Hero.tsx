import type { FC } from 'react'

// Temporary component stubs until proper components are added to @revealui/presentation
const Image = ({ src, alt, className, width, height }: any) => (
  <img src={src} alt={alt} className={className} width={width} height={height} />
)

const Field = ({ children, className }: any) => (
  <div className={className}>{children}</div>
)

const FlexContainer = ({ children, className, index }: any) => (
  <div className={className}>{children}</div>
)

const GridContainer = ({ children, className, index }: any) => (
  <div className={className}>{children}</div>
)

const Heading = ({ children, id, as = 'h2', className }: any) => {
  const Tag = as
  return <Tag id={id} className={className}>{children}</Tag>
}

const Paragraph = ({ children, className }: any) => (
  <p className={className}>{children}</p>
)

const AboutHero: FC = () => {
  return (
    <GridContainer className="mx-auto grid gap-6 p-5 md:grid-cols-2 " index={0}>
      {/* Left Column: Image and Text */}
      <FlexContainer className="flex flex-col gap-3" index={0}>
        <Image
          src="https://res.cloudinary.com/dpytkhyme/image/upload/v1683938638/STREETBEEFS%20SCRAPYARD/295255880_10228797549547476_7761046072649495577_n_cb2cxt.jpg"
          alt="Featured Image"
          className="border-scrapBlack aspect-auto size-full w-full rounded-lg border object-contain"
          width={400}
          height={400}
        />
      </FlexContainer>

      {/* Right Column: Large Text */}
      <FlexContainer className="flex flex-col justify-center" index={0}>
        <Field className="p-1 lg:p-5">
          <Heading
            id="about-hero-heading"
            as="h2"
            className="text-scrapRed dark:text-scrapOrange xl:text-10xl text-5xl font-bold tracking-widest md:text-6xl lg:text-9xl"
          >
            Steve Hagara
          </Heading>
          <Paragraph className="text-scrapWhite dark:text-scrapRed text-lg lg:text-xl">
            Owner, Fighter & CEO of Streetbeefs Scrapyard
          </Paragraph>
        </Field>
      </FlexContainer>
    </GridContainer>
  )
}

export default AboutHero
