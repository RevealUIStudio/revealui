import type { FC } from 'react'

// Temporary component stubs until proper components are added to @revealui/presentation
interface CardComponentProps {
  name: string
  image: string
  label: string
  cta: string
  href: string
  loading?: 'eager' | 'lazy'
}

const Card = ({ name, image, label, cta, href, loading }: CardComponentProps) => (
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

interface ContainerProps {
  children: React.ReactNode
  className?: string
}

const Container = ({ children, className }: ContainerProps) => (
  <div className={className}>{children}</div>
)

interface CardProps {
  name: string
  image: string
  label: string
  cta: string
  href: string
  loading?: 'eager' | 'lazy'
}

const EventsCard: FC = () => {
  const cardProps: CardProps = {
    name: 'Learn More',
    image:
      'https://res.cloudinary.com/dpytkhyme/image/upload/v1699245361/STREETBEEFS%20SCRAPYARD/yardatnight_nahrxr.jpg',
    label: ' Scrapyard Events',
    cta: ' STREETBEEFS SCRAPYARD',
    href: '/',
    loading: 'eager',
  }
  return (
    <Container className="relative isolate z-50 mx-auto w-full ">
      <Card {...cardProps} />
    </Container>
  )
}

export default EventsCard
