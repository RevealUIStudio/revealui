import Link from 'next/link'
import { Image } from 'revealui/ui/images'
import { Container, Field, GridContainer } from 'revealui/ui/shells'
import { Heading, Paragraph } from 'revealui/ui/text'

const MusicHeader = (): React.ReactElement => {
  return (
    <Container className="-z-10 bg-transparent">
      <Container className="from-scrapBlack to-scrapRed relative isolate overflow-hidden bg-gradient-to-l ">
        <Field
          className="from-scrapRed to-scrapBlack shadow-scrapBlack/10 ring-scrapBlack absolute inset-y-0 right-1/2 -z-10 -mr-80 w-[200%] origin-top-right skew-x-[-30deg] bg-gradient-to-b shadow-xl ring-1 sm:-mr-80 lg:-mr-40"
          aria-hidden="true"
        />
        <Container className="max-w-7xl px-6 pt-5 lg:px-8">
          <GridContainer className="max-w-2xl lg:mx-0 lg:grid lg:max-w-none lg:grid-cols-2 lg:gap-x-16 lg:gap-y-6 xl:grid-cols-1 xl:grid-rows-1 xl:gap-x-8">
            <Heading
              className="text-scrapBlack max-w-4xl text-6xl font-extrabold tracking-tight sm:text-6xl lg:col-span-2 xl:col-auto"
              id={''}
            >
              Scrap Records
            </Heading>
            <Field className="mt-6 sm:max-w-md lg:mt-0 lg:max-w-lg xl:col-end-1 xl:row-start-1">
              <Paragraph className="text-scrapWhite text-xl leading-7">
                Streetbeefs Scrapyard is proud to present Scrap Records. A new music label that will
                be releasing music from the Streetbeefs community.
              </Paragraph>
              <Field className="mt-4 flex items-center gap-x-3 lg:gap-x-5">
                <Link
                  href="/"
                  className="bg-scrapBlack text-scrapWhite hover:bg-scrapOrange focus-visible:outline-scrapBlack rounded-md px-3.5 py-2.5 text-sm font-semibold shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  Get started
                </Link>
              </Field>
            </Field>
            <Image
              src="https://res.cloudinary.com/dpytkhyme/image/upload/v1693437335/scrap_records_logo_sdwhr8.png"
              alt=""
              className="z-10 aspect-[6/5] w-full max-w-lg rounded-2xl object-cover p-14 hover:brightness-200 hover:ease-in-out sm:mt-16 lg:mt-0 lg:max-w-7xl xl:row-span-2 xl:row-end-2 xl:mt-20 xl:max-w-none"
            />
          </GridContainer>
        </Container>
        <Field className="from-scrapRed absolute inset-0 -z-10 h-24 bg-gradient-to-t sm:h-32" />
      </Container>
    </Container>
  )
}

export default MusicHeader
