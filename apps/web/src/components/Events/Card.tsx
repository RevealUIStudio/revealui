import { type FC } from "react";
import { Card } from "reveal/ui/cards";
import { Container } from "reveal/ui/shells";

interface CardProps {
  name: string;
  image: string;
  label: string;
  cta: string;
  href: string;
  loading?: "eager" | "lazy";
}

const EventsCard: FC = () => {
  const cardProps: CardProps = {
    name: "Learn More",
    image:
      "https://res.cloudinary.com/dpytkhyme/image/upload/v1699245361/STREETBEEFS%20SCRAPYARD/yardatnight_nahrxr.jpg",
    label: " Scrapyard Events",
    cta: " STREETBEEFS SCRAPYARD",
    href: "/",
    loading: "eager",
  };
  return (
    <Container className="relative isolate z-50 mx-auto w-full ">
      <Card {...cardProps} />
    </Container>
  );
};

export default EventsCard;
