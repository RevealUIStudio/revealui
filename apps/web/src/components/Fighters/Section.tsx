import { Image } from 'revealui/ui/images'
import { Container, Field, FlexContainer, GridContainer } from 'revealui/ui/shells'
import { Heading, Paragraph, TagLine } from 'revealui/ui/text'

const FighterSection = () => {
  const fighters = [
    {
      id: 1,
      name: 'Viking Warrior',
      title: 'Streetbeefs ScrapYard',
      text: 'these are the fighters that are trending in the streetbeefs scrapyard.',
      imageUrl:
        'https://res.cloudinary.com/dpytkhyme/image/upload/v1711487401/STREETBEEFS%20SCRAPYARD/website%20new/1708928197465_zwxjyx.jpg',
      style: ['Western Boxing'],
      colorful: true,
    },
    {
      id: 2,
      name: 'Crazy Legs',
      title: 'Streetbeefs ScrapYard',
      text: 'these are the fighters that are trending in the streetbeefs scrapyard.',
      imageUrl:
        'https://res.cloudinary.com/dpytkhyme/image/upload/v1711487398/STREETBEEFS%20SCRAPYARD/website%20new/1679451651718_lwh6js.jpg',
      style: ['Kick/Thai Boxing'],
      colorful: false,
    },
    {
      id: 3,
      name: 'Firechicken',
      title: 'favorite fighter and owner',
      text: 'Collect and trade your favorite fighters as NFTs. Limited edition.',
      imageUrl:
        'https://res.cloudinary.com/dpytkhyme/image/upload/v1711631143/STREETBEEFS%20SCRAPYARD/website%20new/1679451006817_wboqon.jpg',
      style: ['Western Boxing & Jiu-Jitsu'],
      colorful: true,
    },
    {
      id: 4,
      name: 'Solo',
      title: 'FighterCard NFTs',
      text: 'Collect and trade your favorite fighters as NFTs. Limited edition.',
      imageUrl:
        'https://res.cloudinary.com/dpytkhyme/image/upload/v1711487395/STREETBEEFS%20SCRAPYARD/website%20new/1679451245288_mqab4w.jpg',
      style: ['Kick/Thai Boxing'],
      colorful: false,
    },
  ]
  return (
    <FighterWrapper
      id="roster"
      crosses={false}
      crossesOffset={' right-10'}
      customPaddings={' py-10 lg:py-24 '}
    >
      <Container className="container mx-auto p-2 ">
        <FighterHeading
          tag="Ready to get started"
          title="What we're working on"
          className={'text-scrapWhite dark:text-scrapOrange mb-12 md:mb-20'}
          text={
            " We're always working on new features and improvements. Here are some of the things we're working on right now."
          }
        />

        <GridContainer className="md:pb-18 relative grid gap-6 md:grid-cols-2 md:gap-4">
          {fighters.map((fighter) => {
            const styleDisplay = fighter.style.join()

            return (
              <FlexContainer
                className={`rounded-[2.5rem] even:md:translate-y-28 ${
                  fighter.colorful ? 'bg-scrapBlack/40' : 'bg-inherit'
                }`}
                key={fighter.id}
              >
                <Container className="border-scrapWhite relative overflow-hidden rounded-[2.4375rem] border bg-current">
                  <Field className="absolute left-0 top-0 max-w-fit">
                    <Image
                      src={
                        'https://res.cloudinary.com/dpytkhyme/image/upload/v1691668056/STREETBEEFS%20SCRAPYARD/website%20new/Logos/FB_IMG_1671224440324_zu6blv.jpg'
                      }
                      width={500}
                      height={500}
                      alt="Grid"
                    />
                  </Field>
                  <Container className=" z-1 relative size-full overflow-hidden">
                    <FlexContainer className="my-20 items-center justify-between overflow-hidden lg:my-28">
                      <TagLine className="text-scrapWhite dark:text-scrapOrange text-4xl">
                        {fighter.name}
                      </TagLine>
                      <FlexContainer className="bg-scrapRed place-content-end rounded px-4 py-2">
                        <Field className="text-scrapWhite dark:text-scrapOrange text-md">
                          {styleDisplay}
                        </Field>
                      </FlexContainer>
                    </FlexContainer>

                    <Field>
                      <Image src={fighter.imageUrl} width={628} height={426} alt={fighter.title} />
                    </Field>
                    <Field className="mx-auto p-5">
                      <Heading
                        id=""
                        as={'h2'}
                        className="text-scrapWhite dark:text-scrapOrange prose-h2 "
                      >
                        {fighter.title}
                      </Heading>
                      <Paragraph className="prose-p text-scrapWhite dark:text-scrapOrange text-xl">
                        {fighter.text}
                      </Paragraph>
                    </Field>
                  </Container>
                </Container>
              </FlexContainer>
            )
          })}
        </GridContainer>
      </Container>
    </FighterWrapper>
  )
}

const FighterHeading = ({
  className,
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
    <Field className={`${className} mx-auto mb-12 max-w-[50rem] md:text-center lg:mb-20`}>
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

export default FighterSection
