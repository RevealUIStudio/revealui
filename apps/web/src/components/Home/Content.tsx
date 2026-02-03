import type React from 'react'
import { useEffect, useMemo, useState } from 'react'

// Temporary utility stubs until proper implementations are added
type BannerData = {
  id: number
  image: string
  alt: string
  title?: string
}

const fetchBanner = async (): Promise<BannerData[]> => {
  // Stub implementation - returns empty array
  return []
}

// Temporary component stubs until proper components are added to @revealui/presentation
interface PromoBannerProps {
  image: string
  alt: string
}

const PromoBanner = ({ image, alt }: PromoBannerProps) => (
  <div style={{ width: '100%', overflow: 'hidden' }}>
    <img src={image} alt={alt} style={{ width: '100%', height: 'auto' }} />
  </div>
)

interface Stat {
  id: number
  label: string
  value: string
}

interface StatsListProps {
  stats: Stat[]
}

const StatsList = ({ stats }: StatsListProps) => (
  <div style={{ display: 'grid', gap: '1rem', padding: '1rem' }}>
    {stats.map((stat: Stat) => (
      <div key={stat.id}>
        <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{stat.value}</div>
        <div style={{ fontSize: '1rem' }}>{stat.label}</div>
      </div>
    ))}
  </div>
)

interface BannerComponentProps {
  url: string
}

const Banner = ({ url }: BannerComponentProps) => (
  <div style={{ width: '100%', height: '100%', backgroundImage: `url(${url})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
)

interface GridContainerProps {
  children: React.ReactNode
  className?: string
  index?: number
}

const GridContainer = ({ children, className, index }: GridContainerProps) => (
  <div className={className}>{children}</div>
)

interface SkeletonProps {
  children: React.ReactNode
}

const Skeleton = ({ children }: SkeletonProps) => (
  <div>{children}</div>
)

interface BannerProps {
  image: string
  alt: string
  heading: string
  subheading: string
  description: string
  cta: string
  highlight: string
  punctuation: string
  stats: Stat[]
  link: {
    href: string
    text: string
  }
}

const HomeContent: React.FC = () => {
  const stats = useMemo(
    () => [
      { label: 'Subscribers', value: '476K', id: 1 },
      { label: 'Videos', value: '1.9k', id: 2 },
      { label: 'Views', value: '180,430,351', id: 3 },
      { label: 'Fighters', value: '500+', id: 4 },
    ],
    [],
  )
  const initialBanner: BannerProps = useMemo(
    () => ({
      image:
        'https://res.cloudinary.com/dpytkhyme/image/upload/v1691668068/STREETBEEFS%20SCRAPYARD/website%20new/non%20fight%20pictures/yard/FB_IMG_1666183588935_zkdfmv.jpg',
      alt: 'Streetbeefs Scrapyard banner image',
      heading: 'Welcome!',
      subheading: 'Discover More',
      description: 'Check out the latest stats',
      cta: 'Join Now',
      highlight: 'here is the highlight',
      punctuation: '.',
      stats: stats,
      link: { href: '/about', text: 'Learn More' },
    }),
    [stats],
  )
  const [banner, setBanner] = useState<BannerProps>(initialBanner)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchBanner()
      .then((data: BannerData[]) => {
        // fetchBanner returns an array, take the first item if available
        if (data.length > 0) {
          const bannerData = data[0]
          if (bannerData) {
            // BannerData doesn't include description/link, so use initial values
            setBanner({
              image: bannerData.image || initialBanner.image,
              alt: bannerData.alt || initialBanner.alt,
              heading: bannerData.title || initialBanner.heading,
              subheading: initialBanner.subheading,
              description: initialBanner.description,
              cta: initialBanner.cta,
              highlight: initialBanner.highlight,
              punctuation: initialBanner.punctuation,
              stats: initialBanner.stats,
              link: initialBanner.link,
            })
          }
        }
        setIsLoading(false)
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Failed to fetch banner data'
        setError(message)
        setIsLoading(false)
      })
  }, [initialBanner])

  if (isLoading) {
    return <Skeleton>Loading content...</Skeleton>
  }

  if (error) {
    return <div>Error: {error}</div>
  }

  return (
    <>
      <GridContainer className="grid-cols-1 lg:grid-cols-2" index={0}>
        <Banner url={banner.image} />
        <ContentSection content={banner} />
      </GridContainer>
      <PromoBanner image={banner.image} alt={banner.alt} />
    </>
  )

  function ContentSection({ content }: { content: BannerProps }) {
    return <StatsList stats={content.stats} />
  }
}

export default HomeContent
