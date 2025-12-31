import { cn } from "reveal/ui/layouts/classNames";
import { GridContainer, Container, Field } from "reveal/ui/shells";
import { Heading, Paragraph } from "reveal/ui/text";
import { Image } from "reveal/ui/images";

const FighterCard = ({ ...props }) => {
  const firechickenStats = [
    { id: 1, category: "Home", value: "Port Harbor, WA" },
    { id: 2, category: "Type", value: "MMA" },
    { id: 3, category: "Weight", value: "190lbs" },
    { id: 4, category: "Height", value: `6ft 0in` },
    { id: 5, category: "Reach", value: "72in" },
    { id: 6, category: "Record", value: "20-0" },
  ];
  const vikingWarriorStats = [
    { category: "Home", value: "Port Harbor, WA" },
    { category: "Type", value: "MMA" },
    { category: "Weight", value: "190lbs" },
    { category: "Height", value: `6ft 0in` },
    { category: "Reach", value: "72in" },
    { category: "Record", value: "20-0" },
  ];
  return (
    <>
      <GridContainer
        {...props}
        className={cn(
          " lg:col-start-6 xl:col-start-5",
          " lg:col-start-1",
          " lg:col-span-12 lg:row-span-1 lg:row-start-1",
        )}
      >
        <Container className="relative z-10 mx-auto max-w-2xl  lg:max-w-5xl ">
          <GridContainer
            id="features-heading"
            className="mx-auto max-w-3xl rounded border-2 lg:grid lg:grid-cols-2 lg:gap-x-6 xl:grid-cols-3"
          >
            <Field className="aspect-auto size-full max-w-lg">
              <Image
                src="https://isrnomxlkzfngwebohyx.supabase.co/storage/v1/object/public/images/Firechicken-profile.png?t=2023-09-30T09%3A00%3A54.321Z"
                alt="firechicken fighter"
                className="border-scrapOrange to-scrapBlack size-full max-w-xl rounded border-2 object-cover object-center"
              />
            </Field>

            <Container className=" pt-10 lg:col-start-2">
              <Heading
                id="fighters-heading"
                as={"h2"}
                className="text-scrapOrange px-3 text-2xl font-medium"
              >
                League of Fighters
              </Heading>
              <Paragraph className="text-scrapRed px-2 pt-4 text-4xl font-bold tracking-tight">
                Firechicken
              </Paragraph>
              <Paragraph className="text-scrapWhite px-3 py-4">
                Mixed Martial Arts (MMA)
              </Paragraph>
              <Field className="pt-5">
                <Field className="mx-auto max-w-6xl">
                  <Container className="bg-scrapWhite/5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 ">
                    {firechickenStats.map((stat) => (
                      <Field key={stat.category} className="bg-scrapBlack p-5 ">
                        <Heading
                          as={"h2"}
                          id="fighter-stat"
                          className=" text-scrapYellow font-bold leading-6 underline"
                        >
                          {stat.category}
                        </Heading>

                        <Paragraph className="text-scrapWhite inline-flex items-baseline gap-x-1 pt-2 text-lg font-semibold tracking-tight lg:gap-x-6">
                          {stat.value}
                        </Paragraph>
                      </Field>
                    ))}
                  </Container>
                </Field>
              </Field>
            </Container>
          </GridContainer>
        </Container>
        <Container className="border-scrapOrange bg-scrapBlack/10 relative z-10  mx-auto max-w-md rounded border-2 lg:max-w-2xl ">
          <GridContainer
            id="features-heading"
            className=" border-scrapBlue max-w-3xl rounded border-2 lg:max-w-6xl lg:grid-cols-2 lg:gap-x-5 xl:max-w-none"
          >
            <Field className="aspect-auto size-full max-w-lg">
              <Image
                src="https://isrnomxlkzfngwebohyx.supabase.co/storage/v1/object/public/images/VikingWarrior-profile.png?t=2023-09-30T09%3A00%3A54.321Z"
                alt="VikingWarrior fighter"
                className="border-scrapOrange to-scrapBlack size-full max-w-md rounded border-2 object-cover object-center lg:max-w-2xl"
              />
            </Field>

            <Container className=" pt-10 lg:col-start-2">
              <Heading
                id=""
                as={"h2"}
                className="text-scrapOrange px-3 text-2xl font-medium"
              >
                League of Fighters
              </Heading>
              <Paragraph className="text-scrapRed px-2 pt-4 text-4xl font-bold tracking-tight">
                VikingWarrior
              </Paragraph>
              <Paragraph className="text-scrapWhite px-3 py-4">
                Mixed Martial Arts (MMA)
              </Paragraph>
              <Container className="pt-5">
                <Field className="mx-auto max-w-6xl">
                  <Field className="bg-scrapWhite/5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 ">
                    {vikingWarriorStats.map((stat) => (
                      <Field key={stat.category} className="bg-scrapBlack p-5">
                        <Heading
                          id=""
                          as={"h2"}
                          className=" text-scrapYellow font-bold leading-6 underline"
                        >
                          {stat.category}
                        </Heading>

                        <Paragraph className="text-scrapWhite inline-flex items-baseline gap-x-1 pt-2 text-lg font-semibold tracking-tight lg:gap-x-6">
                          {stat.value}
                        </Paragraph>
                      </Field>
                    ))}
                  </Field>
                </Field>
              </Container>
            </Container>
          </GridContainer>
        </Container>
      </GridContainer>
    </>
  );
};

export default FighterCard;
