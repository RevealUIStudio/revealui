// Temporary component stubs until proper components are added to @revealui/presentation
interface FlexContainerProps {
  children: React.ReactNode
}

const FlexContainer = ({ children }: FlexContainerProps) => (
  <div style={{ display: 'flex', flexDirection: 'column' }}>{children}</div>
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

const FighterContent = () => {
  return (
    <FlexContainer>
      <Heading id="" as={'h1'} className="prose-h1 text-center text-3xl font-bold">
        Fighter Content
      </Heading>
      <Paragraph className="prose-p">
        The Viking Warrior is a talented boxer who has been fighting for over 10 years. He is known
        for his aggressive fighting style and has a reputation for being a tough opponent. The
        Firechicken is a professional mixed martial artist who has been fighting for over 15 years.
        He has a background in western boxing. He has fought in various promotions around the yard.
        He is known for his technical fighting style and has a reputation for being a skilled and
        intelligent fighter.
      </Paragraph>
    </FlexContainer>
  )
}

export default FighterContent
