import { logger } from '@revealui/core/utils/logger'
import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'

// Temporary utility stubs until proper implementations are added
type HeroData = {
  id: number
  title: string
  description: string
  image: string
  alt: string
}

const fetchHero = async (): Promise<HeroData[]> => {
  // Stub implementation - returns empty array
  return []
}

// Temporary component stubs until proper components are added to @revealui/presentation
interface ImageProps {
  src: string
  alt: string
  className?: string
  width?: number
  height?: number
  loading?: 'eager' | 'lazy'
}

const Image = ({ src, alt, className, width, height, loading }: ImageProps) => (
  <img src={src} alt={alt} className={className} width={width} height={height} loading={loading} />
)

interface ContainerProps {
  children: ReactNode
  className?: string
}

const Container = ({ children, className }: ContainerProps) => (
  <div className={className}>{children}</div>
)

interface FieldProps {
  children?: ReactNode
  className?: string
}

const Field = ({ children, className }: FieldProps) => (
  <div className={className}>{children}</div>
)

interface GridContainerProps {
  children: ReactNode
  className?: string
}

const GridContainer = ({ children, className }: GridContainerProps) => (
  <div className={className}>{children}</div>
)

interface SkeletonProps {
  children: ReactNode
}

const Skeleton = ({ children }: SkeletonProps) => (
  <div>{children}</div>
)

interface MottoProps {
  className?: string
}

const Motto = ({ className }: MottoProps) => (
  <div className={className}>
    <h1 style={{ fontSize: '3rem', fontWeight: 'bold' }}>STREETBEEFS</h1>
    <p style={{ fontSize: '1.5rem' }}>SCRAPYARD</p>
  </div>
)

interface HeroProps {
  id: number
  image: string
  videos: string
  altText: string
  href: string
}

const HomeHero = (): React.ReactElement => {
  const heroData: HeroProps[] = useMemo(
    () => [
      {
        id: 1,
        image:
          'https://res.cloudinary.com/dpytkhyme/image/upload/v1686557282/STREETBEEFS%20SCRAPYARD/firechicken_animated_photo_fj1xej.jpg',
        altText: 'Firechicken animated photo',
        href: 'https://www.youtube.com/@streetbeefsScrapyard',
        videos: 'https://www.youtube.com/@streetbeefsScrapyard',
      },
    ],
    [],
  )

  const [heros, setHeros] = useState<HeroProps[]>(heroData)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | ReactNode>(null)

  useEffect(() => {
    fetchHero()
      .then((data: HeroData[]) => {
        if (Array.isArray(data) && data.length > 0) {
          const mappedHeros: HeroProps[] = data.map((item) => ({
            id: item.id,
            image: item.image,
            altText: item.alt,
            href: '',
            videos: '',
          }))
          setHeros(mappedHeros)
        } else {
          logger.debug('Fetched data is empty, retaining initial data')
        }
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Failed to fetch hero data'
        logger.error('Error fetching hero', { error })
        setError(message)
      })
      .finally(() => setIsLoading(false))
  }, [])

  if (isLoading) {
    return <Skeleton>Loading hero...</Skeleton>
  }

  if (error) {
    return <div>Error: {error}</div>
  }

  if (!heros) {
    return <div>No hero content available.</div>
  }
  return (
    <>
      {heros.map((hero) => (
        <HeroItem key={hero.id} hero={hero} />
      ))}
    </>
  )
}

const HeroItem = (hero: { hero: HeroProps }) => {
  return (
    <Container className="lg:max-w-9xl relative isolate z-50 mx-auto aspect-auto size-full max-w-4xl p-3">
      <GridContainer className="mx-auto aspect-auto size-full max-w-xl grid-cols-1 place-content-baseline lg:max-w-4xl lg:grid-cols-2 lg:place-content-center">
        <Field className="mx-auto aspect-auto max-h-96 max-w-xl pb-10 lg:max-h-max lg:max-w-2xl">
          <Motto className="aspect-auto max-w-xl grid-cols-1 place-content-center lg:max-w-2xl lg:place-content-start" />
        </Field>
        <Field className="mx-auto aspect-auto size-full min-w-full max-w-md place-content-center rounded-2xl p-1 shadow-2xl lg:max-w-xl xl:max-w-3xl">
          <Image
            className="border-scrapBlack mx-auto aspect-auto size-full min-w-full max-w-md place-content-center rounded-xl border-double object-cover shadow-2xl lg:max-w-xl xl:max-w-3xl"
            loading="eager"
            width={500}
            height={500}
            alt="home-hero-image"
            src={hero.hero.image}
          />
        </Field>
      </GridContainer>
    </Container>
  )
}

export default HomeHero
