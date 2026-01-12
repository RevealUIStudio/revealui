import type React from 'react'
import { Image } from 'revealui/ui/images'
import { List, UList } from 'revealui/ui/lists'
import { Container, Field, FlexContainer, GridContainer } from 'revealui/ui/shells'
import { Heading, Paragraph, TagLine } from 'revealui/ui/text'

const FightersHero: React.FC = () => {
  const icons: string[] = [
    'https://res.cloudinary.com/dpytkhyme/image/upload/v1717457061/STREETBEEFS%20SCRAPYARD/streetbeefs-scrapyard-logo-1_jnrb9t.webp',
    'https://res.cloudinary.com/dpytkhyme/image/upload/v1717457061/STREETBEEFS%20SCRAPYARD/streetbeefs-scrapyard-logo-1_jnrb9t.webp',
    'https://res.cloudinary.com/dpytkhyme/image/upload/v1717457061/STREETBEEFS%20SCRAPYARD/streetbeefs-scrapyard-logo-1_jnrb9t.webp',
  ]

  const scrapyardServices: string[] = ['Custom Profile', 'Members only content', 'Exclusive events']
  const heroImage =
    'https://res.cloudinary.com/dpytkhyme/image/upload/v1691668455/STREETBEEFS%20SCRAPYARD/website%20new/non%20fight%20pictures/group/IMG_0144_b20lnl.jpg'

  return (
    <FighterWrapper
      id="how-to-use"
      className="mx-auto bg-inherit"
      crosses={true}
      crossesOffset="right-10"
      customPaddings="py-16 lg:py-20 xl:py-24"
    >
      <Container>
        <FlexContainer className="z-1 relative mb-5 w-1/2 flex-col items-center overflow-hidden rounded-3xl border lg:flex-row ">
          <ImageSection src={heroImage} />
          <TextSection items={scrapyardServices} icons={icons} />
        </FlexContainer>

        <GridContainer className="z-1 relative gap-5">
          <PromoSection image="https://res.cloudinary.com/dpytkhyme/image/upload/v1691668451/STREETBEEFS%20SCRAPYARD/website%20new/promotion/Snapshot_184_bgt4zw.png" />
        </GridContainer>
      </Container>
    </FighterWrapper>
  )
}

const ImageSection = ({ src }: { src: string }) => {
  return (
    <Field className="pointer-events-none left-0 top-0 aspect-auto size-full md:w-3/5 xl:w-auto">
      <Image
        className="aspect-auto object-cover md:object-right"
        width={800}
        alt="Scrapyard fighters"
        height={730}
        src={src}
      />
    </Field>
  )
}
const TextSection: React.FC<{ items: string[]; icons?: string[] }> = ({ items }) => {
  const textItems = items.map((item, index) => (
    <List type="ul" key={index} className="size-auto items-start ">
      <Paragraph className="text-scrapWhite dark:text-scrapOrange text-xl">{item}</Paragraph>
    </List>
  ))

  return (
    <Field className="z-1 relative mx-auto max-w-80 py-5 pr-10 lg:ml-auto">
      <Heading id="fighter-heading" as="h2" className="text-scrapWhite dark:text-scrapOrange mb-4">
        Streetbeefs Scrapyard
      </Heading>
      <Paragraph className="text-scrapWhite dark:text-scrapOrange mb-12">
        The Scrapyard is a place where fighters can come and train with other fighters. We offer a
        variety of services to help fighters reach their full potential.
      </Paragraph>
      <UList
        className="text-scrapWhite dark:text-scrapOrange text-xl"
        items={textItems}
        type={'ul'}
      />
    </Field>
  )
}

const PromoSection: React.FC<{
  image: string
}> = ({ image }) => (
  <FlexContainer className="border-scrapWhite relative min-h-20 w-full flex-col overflow-hidden rounded-3xl border lg:flex-row">
    <Field>
      <Image src={image} width={630} height={750} alt="Promotion" />
    </Field>
    <Field className="p-2">
      <FighterHeading
        title="Streetbeefs Scrapyard Fighters"
        text="These are the fighters that are trending in the streetbeefs scrapyard."
        className="text-scrapWhite dark:text-scrapOrange z-50 w-1/2 place-content-center"
        tag="Ready to get started"
      />
    </Field>
  </FlexContainer>
)

const FighterHeading = ({
  title,
  text,
  tag,
}: {
  className: string
  title: string
  text: string
  tag: string
}) => {
  return (
    <Field className={` mx-auto mb-12 max-w-[50rem] md:text-center lg:mb-20`}>
      {tag && <TagLine className="mb-4 text-xl md:justify-center">{tag}</TagLine>}
      {title && (
        <Heading as={'h2'} className="prose-h2 text-scrapWhite text-xl" id={'fighter-heading'}>
          {title}
        </Heading>
      )}
      {text && <Paragraph className="text-scrapWhite mt-4 text-xl ">{text}</Paragraph>}
    </Field>
  )
}

const FighterWrapper = ({
  className,
  id,
  crosses,
  crossesOffset,
  customPaddings,
  children,
}: {
  className?: string
  id: string
  crosses: boolean
  crossesOffset: string
  customPaddings: string
  children: React.ReactNode
}) => {
  return (
    <Container
      id={id}
      className={`
          relative 
          ${customPaddings || `py-10 lg:py-16 xl:py-20 ${crosses ? 'lg:py-32 xl:py-40' : ''}`} 
          ${className || ''}`}
    >
      {children}

      <Field className="pointer-events-none absolute left-5 top-0 hidden h-full w-1 stroke-1 md:block lg:left-7 xl:left-10" />
      <Field className="pointer-events-none absolute right-5 top-0 hidden h-full w-1 stroke-1 md:block lg:right-7 xl:right-10" />

      {crosses && (
        <Field
          className={`absolute inset-x-7 top-0 hidden h-1 stroke-1 ${
            crossesOffset && crossesOffset
          } pointer-events-none right-10 lg:block xl:left-10`}
        />
      )}
    </Container>
  )
}

export default FightersHero
