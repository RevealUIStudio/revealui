import type React from 'react'
import { useEffect, useMemo, useState } from 'react'
import { type MainInfo as FetchMainInfo, fetchMainInfos } from 'revealui/client/http'
import type { ContentSectionProps, MainInfo } from 'revealui/types/interfaces/app'
import { Image } from 'revealui/ui/images'
import { Field, GridContainer, Skeleton } from 'revealui/ui/shells'
import Container from 'revealui/ui/shells/Container'
import { Heading, Paragraph } from 'revealui/ui/text'

const HomeMain: React.FC = () => {
  const mainInfos: MainInfo[] = useMemo(
    () => [
      {
        id: 1,
        title: 'Scrapyard',
        subtitle: 'Welcome to the Scrapyard',
        description:
          'The Scrapyard is a place where you can find all the latest news and updates from the Streetbeefs community.',
        image:
          'https://res.cloudinary.com/dpytkhyme/image/upload/v1699245361/STREETBEEFS%20SCRAPYARD/yardday_zkkuvn.jpg',
      },
    ],
    [],
  )

  const [info, setInfo] = useState<MainInfo[]>(mainInfos)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchMainInfos()
      .then((data: FetchMainInfo[]) => {
        setInfo(data.length > 0 ? data : mainInfos)
        setIsLoading(false)
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Failed to fetch data'
        setError(message)
        setIsLoading(false)
      })
  }, [mainInfos])

  if (isLoading) {
    return <Skeleton>Loading Info...</Skeleton>
  }

  if (error) {
    return <div>Error: {error}</div>
  }

  if (info.length === 0) {
    return <div>No content available.</div>
  }

  return (
    <>
      {info.map((infoItem, idx) => (
        <ContentSection key={infoItem.id} info={infoItem} index={idx} />
      ))}
    </>
  )
}

const ContentSection = ({ info }: ContentSectionProps) => {
  const { title, subtitle, description, image } = info

  return (
    <Container className="relative isolate z-50 mx-auto">
      <GridContainer className="mx-auto grid-cols-1 p-1 lg:grid-cols-2" index={0}>
        <Field className="w-full max-w-sm place-content-center rounded-2xl p-1 shadow-2xl lg:max-w-xl lg:place-content-end xl:max-w-2xl">
          <Image
            className="border-scrapBlack size-full rounded-xl border-double p-1 shadow-2xl lg:max-w-xl xl:max-w-2xl"
            src={image}
            alt={`Image for ${title}`}
          />
        </Field>
        <Field className="my-auto p-3">
          <Heading
            id="main-title"
            as="h1"
            className="text-scrapWhite dark:text-scrapWhite text-center text-5xl lg:text-6xl"
          >
            {title}
          </Heading>
          <Heading
            id="main-subtitle"
            as="h2"
            className="text-scrapWhite dark:text-scrapWhite mt-4 px-2 text-3xl"
          >
            {subtitle}
          </Heading>
          <Paragraph className="text-scrapWhite dark:text-scrapWhite text-xl">
            {description}
          </Paragraph>
        </Field>
      </GridContainer>
    </Container>
  )
}

export default HomeMain
