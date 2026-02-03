// Temporary component stubs until proper components are added to @revealui/presentation
interface HeadingProps {
  children: React.ReactNode
  id?: string
}

const Heading = ({ children, id }: HeadingProps) => (
  <h1 id={id}>{children}</h1>
)

const Dashboard = () => {
  return <Heading id={''}>Dashboard</Heading>
}

export default Dashboard
