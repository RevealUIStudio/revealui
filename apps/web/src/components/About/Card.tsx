import type { FC } from 'react'
import { useRef } from 'react'

// Temporary component stubs until proper components are added to @revealui/presentation
const Card = ({ name, image, label, cta, href }: any, ref?: any) => (
  <div ref={ref} style={{ border: '1px solid #ccc', borderRadius: '8px', padding: '1rem', maxWidth: '400px' }}>
    <img src={image} alt={label} style={{ width: '100%', borderRadius: '4px' }} />
    <h3 style={{ marginTop: '1rem' }}>{name}</h3>
    <p>{label}</p>
    <a href={href} style={{ display: 'inline-block', marginTop: '0.5rem', color: '#0070f3' }}>
      {cta}
    </a>
  </div>
)

const AboutCard: FC = () => {
  const ref = useRef<HTMLDivElement>(null)
  const cardProps = {
    name: 'Sign Up Now',
    image: 'src/assets/images/yardatnight.jpg',
    label: 'Special Thanks to the OG Branch for making all of this possible!',
    cta: 'Check them out!',
    href: '/events',
  }

  return <Card ref={ref} {...cardProps} />
}

export default AboutCard
