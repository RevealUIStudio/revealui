import {
  EventsBackground,
  EventsCard,
  EventsHeader,
  EventsHero,
  EventsMain,
  EventsSection,
} from '../../components/Events/index.js'

export { Page }

function Page(): React.ReactElement {
  return (
    <EventsBackground>
      <EventsHeader />
      <EventsMain />
      <EventsSection />
      <EventsHero />
      <EventsCard />
    </EventsBackground>
  )
}
