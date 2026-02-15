import type React from 'react'
import { useEffect, useMemo, useState } from 'react'

// Temporary utility stubs until proper implementations are added
type FetchCardData = {
  name: string
  image: string
  label: string
  cta: string
  href: string
  loading?: 'eager' | 'lazy'
}

const fetchCard = (): Promise<FetchCardData[]> => {
  // Stub implementation - returns empty array
  return Promise.resolve([])
}

// Temporary component stubs until proper components are added to @revealui/presentation
interface CardProps {
  name: string
  image: string
  label: string
  cta: string
  href: string
  loading?: 'eager' | 'lazy'
}

const Card = ({ name, image, label, cta, href, loading }: CardProps) => (
  <div
    style={{ border: '1px solid #ccc', borderRadius: '8px', padding: '1rem', maxWidth: '400px' }}
  >
    <img src={image} alt={label} loading={loading} style={{ width: '100%', borderRadius: '4px' }} />
    <h3 style={{ marginTop: '1rem' }}>{name}</h3>
    <p>{label}</p>
    <a href={href} style={{ display: 'inline-block', marginTop: '0.5rem', color: '#0070f3' }}>
      {cta}
    </a>
  </div>
)

interface SkeletonProps {
  children: React.ReactNode
}

const Skeleton = ({ children }: SkeletonProps) => <div>{children}</div>

type CardData = {
  name: string
  image: string
  label: string
  cta: string
  href: string
  loading?: 'eager' | 'lazy'
}

const HomeCard: React.FC = () => {
  const initialData: CardData = useMemo(
    () => ({
      name: 'Scrapyard Records',
      image:
        'https://res.cloudinary.com/dpytkhyme/image/upload/v1686377854/STREETBEEFS%20SCRAPYARD/received_379940754080520_hzf7q1.jpg',
      label: 'ScrapRecords Label',
      cta: 'Check out all Media',
      href: '/',
      loading: 'eager',
    }),
    [],
  )
  const [cardData, setCardData] = useState<CardData>(initialData)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setIsLoading(true)
    fetchCard()
      .then((data: FetchCardData[]) => {
        setCardData(data.length > 0 && data[0] ? data[0] : initialData)
        setIsLoading(false)
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Failed to fetch card data'
        setError(message)
        setIsLoading(false)
      })
  }, [initialData])

  if (isLoading) {
    return <Skeleton>Loading card...</Skeleton>
  }

  if (error) {
    return <div>Error: {error}</div>
  }

  return <Card {...cardData} />
}

export default HomeCard
