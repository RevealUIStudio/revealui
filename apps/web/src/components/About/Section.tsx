import Link from "next/link";
import { JobOpeningsList } from "reveal/ui/lists";
import { Container, Field, GridContainer } from "reveal/ui/shells";
import { Heading, Span, Paragraph } from "reveal/ui/text";
import { Image } from "reveal/ui/images";
const AboutSection = () => {
  const jobOpenings = [
    {
      id: 1,
      role: "Fighters join us",
      href: "#",
      description:
        "We are looking for fighters to join our team. We are looking for fighters who are willing to fight for the community.",
      salary: "RESPECT",
      location: "Gig Harbor, WA",
    },
    {
      id: 2,
      role: "nurses welcome",
      href: "#",
      description:
        "We are looking for nurses to join our team. We are looking for nurses who are willing to fight for the community.",
      salary: "RESPECT",
      location: "Gig Harbor, WA",
    },
    {
      id: 3,
      role: "Work the event",
      href: "#",
      description:
        "We are looking for people to work the event. We are looking for people who are willing to fight for the community.",
      salary: "RESPECT",
      location: "Gig Harbor, WA",
    },
    {
      id: 4,
      role: "Volunteers",
      href: "#",
      description:
        "We are looking for volunteers to join our team. We are looking for volunteers who are willing to fight for the community.",
      salary: "RESPECT",
      location: "Gig Harbor, WA",
    },
  ];
  const jobOpeningsValues = jobOpenings.map((job) => ({
    ...job,
    id: String(job.id),
  }));

  return (
    <Container className="relative isolate mx-auto bg-transparent">
      <Field className=" place-content-center">
        <Heading
          id="about-join-heading"
          variant="h2"
          className="text-scrapYellow dark:text-scrapGreen mx-auto my-10 max-w-4xl text-center text-4xl font-bold tracking-widest lg:text-5xl"
        >
          We&apos;re always looking for awesome people to join us at the
          Scrapyard
        </Heading>
      </Field>
      <GridContainer className="grid-cols-1 p-5 lg:grid-cols-2">
        <Field className="relative ">
          <Image
            src="https://res.cloudinary.com/dpytkhyme/image/upload/v1683582412/STREETBEEFS%20SCRAPYARD/received_389244490016692_b7iiji.jpg"
            alt=""
            className="bg-scrapYellow aspect-auto w-full rounded-2xl object-contain lg:h-[32rem]"
          />
        </Field>
        <Field className="relative mx-auto place-content-center p-5">
          <Heading className="max-w-2xl" id="about-join-heading" as={"h2"}>
            <Span
              className={`text-scrapOrange dark:text-scrapBlue mx-auto my-10 max-w-sm text-center text-2xl font-extrabold tracking-widest lg:max-w-xl lg:text-7xl`}
            >
              Want to join the team?
            </Span>
          </Heading>
          <Paragraph className="text-scrapWhite dark:text-scrapOrange max-w-sm text-center text-lg leading-7 lg:max-w-xl lg:text-end lg:text-2xl">
            We are always looking for new fighters and volunteers to help us
            out.
          </Paragraph>
          <Paragraph className="text-scrapWhite dark:text-scrapBlue border-scrapBlue mt-20 text-center text-xl leading-7 lg:text-3xl">
            Reach out to us on Facebook
          </Paragraph>
          <Field className="border-scrapYellow mx-auto w-full max-w-md border-t pt-8 text-center lg:max-w-lg">
            <Link
              href="https://www.facebook.com/Streetbeefs-Scrapyard-100646632233996"
              className="text-scrapOrange hover:text-scrapBlue mx-auto w-auto max-w-xs text-center text-sm font-semibold leading-6 brightness-150 hover:brightness-200"
            >
              View all openings
              <span
                className="mx-auto -mt-6 w-auto px-1 pb-10 pt-0"
                aria-hidden="true"
              >
                &rarr;
              </span>
            </Link>
          </Field>
        </Field>
      </GridContainer>
      <JobOpeningsList jobOpenings={jobOpeningsValues} />
    </Container>
  );
};

export default AboutSection;
