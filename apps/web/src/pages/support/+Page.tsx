import { Button } from "reveal/ui/buttons";
import { ImageGrid } from "reveal/ui/images";
import { GridContainer, Field, FlexContainer } from "reveal/ui/shells";
import { Heading, Paragraph } from "reveal/ui/text";
import Container from "reveal/ui/shells/Container";

export { Page };

function Page(): React.ReactElement {
  const product = {
    name: "VIP Access",
    href: "/",
    price: 100.0,
    rating: 5,
    breadcrumbs: [
      { id: 1, name: "Bundles", href: "/" },
      { id: 2, name: "Basic", href: "/" },
    ],
    images: [
      {
        id: "1",
        image:
          "https://res.cloudinary.com/dpytkhyme/image/upload/v1686557282/STREETBEEFS%20SCRAPYARD/firechicken_animated_photo_fj1xej.jpg",
        alt: "",
      },
      // More images...
    ],
    colors: [
      { name: "Washed Black", value: "#6C6C6C" },
      { name: "Washed gray", value: "#F7F0EA" },
      { name: "White", value: "#FFFFFF" },
    ],
    sizes: [
      { name: "XL", selectedSize: "xl" },
      { name: "L", selectedSize: "l" },
      { name: "M", selectedSize: "m" },
      { name: "S", selectedSize: "s" },
      { name: "XS", selectedSize: "xs" },
    ],
    description:
      "The Scrapyard video game is a fighting game featuring all of your favorite STREETBEEFS SCRAPYARD YouTube channel fighters",
    details: [
      {
        name: "Features",
        items: [
          "Multiple button configurations",
          "Assist mode",
          "Online multiplayer",
          "Local multiplayer",
          "Story mode",
          "Arcade mode",
          "Training mode",
        ],
      },
    ],
  };
  return (
    <>
      <Container className="bg-scrapGreen/60 lg:max-w-8xl mx-auto w-full max-w-2xl p-2 sm:px-6 lg:px-2 ">
        <GridContainer className="w-full lg:grid-flow-row lg:grid-cols-2">
          <Field>
            <Heading
              id="product-title"
              as={"h1"}
              className="text-scrapBlack text-3xl font-medium"
            >
              {product.name}
            </Heading>
            <Paragraph className="text-scrapBlack text-3xl font-medium">
              ${product.price}
            </Paragraph>

            <GridContainer>
              <Paragraph className=" text-scrapBlack py-4 font-medium lg:text-lg">
                Currently in Development and Testing Phase & with enough
                donations we can make this a reality sooner!
              </Paragraph>

              <Field className="prose prose-sm lg:prose-lg text-scrapWhite py-2">
                <Paragraph className="text-scrapBlack text-2xl font-bold">
                  {product.description}
                </Paragraph>
              </Field>

              <FlexContainer className="flex flex-col items-start justify-start py-4">
                <Paragraph className="text-scrapBlack text-2xl font-bold">
                  {product.price}
                </Paragraph>
                <Paragraph className="text-scrapBlack text-sm font-medium">
                  {product.description}
                </Paragraph>

                <Button
                  type="submit"
                  className=" bg-scrapBlack text-scrapWhite hover:bg-scrapYellow hover:text-scrapBlack focus:ring-scrapGreen flex w-full items-center justify-center rounded-md border border-transparent px-8 py-3 text-base font-medium focus:outline-none focus:ring-2 focus:ring-offset-2"
                >
                  Donate Now
                </Button>
              </FlexContainer>
            </GridContainer>
          </Field>

          <ImageGrid className="min-w-full" images={product.images} />
        </GridContainer>
      </Container>
    </>
  );
}
