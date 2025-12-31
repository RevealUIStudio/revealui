import { DescriptionList } from "reveal/ui/lists";
import { Container } from "reveal/ui/shells";

const EventsSection = () => {
  const values = [
    { id: "1", name: "Founded Branch", description: "2020" },
    { id: "2", name: "YouTube Subscribers", description: "275+" },
    { id: "3", name: "Scrapyard Warriors", description: "30+" },
    { id: "4", name: "Guns Down Gloves Up", description: "Priceless" },
  ];
  return (
    <Container className="relative isolate z-10 mb-20 ">
      <DescriptionList
        id="events-section-list"
        key={values.map((value) => value.id).join("")}
        items={values.map((value) => ({
          id: value.name,
          name: value.name,
          description: value.description,
        }))}
      />
    </Container>
  );
};

export default EventsSection;
