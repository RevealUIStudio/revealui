// Temporary component stubs until proper components are added to @revealui/presentation
const Heading = ({ children, id }: any) => (
  <h1 id={id}>{children}</h1>
)

const Dashboard = () => {
  return <Heading id={''}>Dashboard</Heading>
}

export default Dashboard
