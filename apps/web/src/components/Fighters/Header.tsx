import type { FC } from 'react'

// Temporary utility stubs until proper implementations are added
const openFacebook = (_event?: React.MouseEvent<HTMLButtonElement>) => {
  // Stub implementation - opens Facebook page
  window.open('https://www.facebook.com/Streetbeefs-Scrapyard-100646632233996', '_blank')
}

// Temporary component stubs until proper components are added to @revealui/presentation
interface LinkProps {
  href: string
  className?: string
  children: React.ReactNode
}

const Link = ({ href, className, children }: LinkProps) => (
  <a href={href} className={className}>
    {children}
  </a>
)

interface ButtonProps {
  children: React.ReactNode
  className?: string
  onClick?: (event?: React.MouseEvent<HTMLButtonElement>) => void
}

const Button = ({ children, className, onClick }: ButtonProps) => (
  <button type="button" className={className} onClick={onClick}>
    {children}
  </button>
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

interface FlexContainerProps {
  children: React.ReactNode
  className?: string
}

const FlexContainer = ({ children, className }: FlexContainerProps) => (
  <div className={className}>{children}</div>
)

interface GridContainerProps {
  children: React.ReactNode
  className?: string
}

const GridContainer = ({ children, className }: GridContainerProps) => (
  <div className={className}>{children}</div>
)

interface HeadingProps {
  children: React.ReactNode
  id?: string
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
  className?: string
}

const Heading = ({ children, id, as = 'h1', className }: HeadingProps) => {
  const Tag = as
  return (
    <Tag id={id} className={className}>
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

interface SpanProps {
  children: React.ReactNode
  className?: string
}

const Span = ({ children, className }: SpanProps) => <span className={className}>{children}</span>

const FighterHeader: FC = () => {
  return (
    <GridContainer className="relative mx-auto h-screen max-w-xl grid-cols-1 place-content-between py-0 lg:grid-flow-row lg:grid-cols-2 lg:place-content-baseline lg:py-5">
      <Container className=" place-content-center lg:place-content-center">
        <FlexContainer className="ring-scrapBlack/10 hover:ring-scrapBlack/20 relative mx-auto max-w-sm place-content-end rounded-full ring-1 md:max-w-md lg:max-w-lg  lg:place-content-center">
          <Field className="text-scrapOrange text-center text-sm leading-6">
            See latest fights{' '}
            <Link
              href="https://www.youtube.com/@streetbeefsScrapyard/videos"
              className="text-scrapWhite font-semibold"
            >
              Watch now <span aria-hidden="true">&rarr;</span>
            </Link>
          </Field>
        </FlexContainer>
        <Field className="place-content-center pt-5 text-center lg:pt-0">
          <Heading
            as={'h1'}
            id="welcome-heading"
            className="text-scrapRed text-5xl font-bold tracking-widest lg:text-7xl"
          >
            <Span className="text-7xl"> welcome </Span> <Span className="text-7xl">to the</Span>{' '}
            <Span className="text-7xl">soldier </Span> <Span className="text-7xl">center</Span>{' '}
          </Heading>
          <Paragraph className="text-scrapWhite mx-auto max-w-sm pt-5 text-lg leading-6 lg:max-w-md lg:pt-0">
            Checkout the latest stats for your favorite Streetbeefs Scrapyard fighters
          </Paragraph>
          <FlexContainer className="flex items-center justify-center gap-x-5 pt-10">
            <Button
              className="text-scrapWhite hover:bg-scrapBlack focus-visible:outline-scrapBlack dark:text-scrapYellow dark:hover:bg-scrapBlack dark:hover:text-scrapOrange rounded-md bg-transparent text-sm font-semibold tracking-widest shadow-sm transition duration-200 ease-in-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              onClick={(event?: React.MouseEvent<HTMLButtonElement>) => {
                if (typeof openFacebook === 'function') {
                  ;(openFacebook as (event?: React.MouseEvent<HTMLButtonElement>) => void)(event)
                } else {
                  window.open(
                    'https://www.facebook.com/Streetbeefs-Scrapyard-100646632233996',
                    '_blank',
                  )
                }
              }}
            >
              Want to Fight?
            </Button>
            <Link
              href="#features-heading"
              className="text-scrapWhite dark:text-scrapOrange hover:text-scrapYellow focus-visible:outline-scrapBlack text-sm font-semibold leading-6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              Learn More <span aria-hidden="true">→</span>
            </Link>
          </FlexContainer>
        </Field>
      </Container>
    </GridContainer>
  )
}

export default FighterHeader
