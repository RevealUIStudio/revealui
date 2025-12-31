import { useEffect, useMemo, useState } from "react";
import { Container, Field, GridContainer, Skeleton } from "reveal/ui/shells";
import { Paragraph, Heading } from "reveal/ui/text";
import fetchEvents from "reveal/core/targets/http/fetchEvents";
import { Image } from "reveal/ui/images";

type Event = {
  id: number;
  title: string;
  name: string;
  description: string;
  image: string;
  alt: string;
};

const HomeSection = () => {
  // Define the initial events data as a constant outside the component
  const initialEvents: Event[] = useMemo(
    () => [
      {
        id: 1,
        title: "EVENTS",
        name: "New Events Monthly",
        description:
          "Whether you are a fighter or a spectator, experience the warrior's courage.",
        image:
          "https://res.cloudinary.com/dpytkhyme/image/upload/v1686377854/STREETBEEFS%20SCRAPYARD/received_379940754080520_hzf7q1.jpg",
        alt: "Event",
      },
    ],
    [],
  );
  const [events, setEvents] = useState<Event[]>(initialEvents);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchEvents()
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setEvents(data);
        } else {
          console.log("Fetched data is empty, retaining initial data.");
        }
      })
      .catch((error) => {
        console.error("Error fetching events:", error);
        setError(error.message);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <Skeleton>
        Loading events...
      </Skeleton>
    );
  if (error) return <div>Error: {error}</div>;
  if (!events.length) return <div>No featured events available.</div>;

  return (
    <>
      {events.map((event) => (
        <EventItem key={event.id} event={event} />
      ))}
    </>
  );
};

const EventItem = ({ event }: { event: Event }) => (
  <Container className="relative isolate z-50 p-1">
    <GridContainer className="grid-cols-1 lg:grid-cols-2">
      <Field className="my-auto p-1">
        <Heading
          id="event-title"
          as="h1"
          className="text-scrapWhite dark:text-scrapWhite text-center text-6xl lg:text-7xl"
        >
          {event.title}
        </Heading>
        <Heading
          as="h2"
          className="text-scrapWhite mt-4 text-3xl lg:text-4xl"
          id={""}
        >
          {event.name}
        </Heading>
        <Paragraph className="text-scrapWhite mt-2 text-lg lg:text-xl">
          {event.description}
        </Paragraph>
      </Field>
      <Field>
        <Image
          src={event.image}
          alt={event.alt}
          className="rounded-xl shadow-2xl"
        />
      </Field>
    </GridContainer>
  </Container>
);

export default HomeSection;
