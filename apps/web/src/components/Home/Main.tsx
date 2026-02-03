import type { ContentSectionProps, MainInfo } from '@revealui/core/types/interfaces/app'
import type React from 'react'
import { useEffect, useMemo, useState } from 'react'

// Temporary utility stubs until proper implementations are added
type FetchMainInfo = MainInfo

const fetchMainInfos = async (): Promise<FetchMainInfo[]> => {
  // Stub implementation - returns empty array
  return []
}

// Temporary component stubs until proper components are added to @revealui/presentation
interface ImageProps {
  src: string
  alt?: string
  className?: string
  width?: number
  height?: number
  loading?: 'eager' | 'lazy'
}

const Image = ({ src, alt, className, width, height, loading }: ImageProps) => (
  <img src={src} alt={alt} className={className} width={width} height={height} loading={loading} />
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

interface GridContainerProps {
  children: React.ReactNode
  className?: string
  index?: number
}

const GridContainer = ({ children, className, index }: GridContainerProps) => (
  <div className={className}>{children}</div>
)

interface SkeletonProps {
  children?: React.ReactNode
  className?: string
  width?: number
  height?: number
}

const Skeleton = ({ children, className, width, height }: SkeletonProps) => (
  <div className={className} style={{ width, height }}>
    {children}
  </div>
)

interface HeadingProps {
  children: React.ReactNode
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
  className?: string
  id?: string
}

const Heading = ({ children, as = 'h1', className, id }: HeadingProps) => {
  const Tag = as
  return (
    <Tag className={className} id={id}>
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
