// Temporary component stubs until proper components are added to @revealui/presentation
const Heading = ({ children, id }: any) => (
  <h1 id={id}>{children}</h1>
)

const Account = () => {
  return <Heading id={''}>Account</Heading>
}

export default Account
