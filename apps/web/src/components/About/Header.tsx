import React from "react";
import { Container, FlexContainer, Field } from "reveal/ui/shells";
import { Heading, Paragraph } from "reveal/ui/text";
import { Image } from "reveal/ui/images";

const AboutHeader: React.FC = () => {
  const imageUrls: string[] = [
    "https://res.cloudinary.com/dpytkhyme/image/upload/v1691668074/STREETBEEFS%20SCRAPYARD/website%20new/Logos/Polish_20220913_090626365_injamk.png",
    "https://res.cloudinary.com/dpytkhyme/image/upload/v1691668009/STREETBEEFS%20SCRAPYARD/website%20new/Fight%20pictures/197189618_10219791637045653_7157978408147018671_n_z5eyxd.jpg",
    "https://res.cloudinary.com/dpytkhyme/image/upload/v1691668059/STREETBEEFS%20SCRAPYARD/website%20new/non%20fight%20pictures/FB_IMG_1642008955477_lgs5an.jpg",
    "https://res.cloudinary.com/dpytkhyme/image/upload/v1691668058/STREETBEEFS%20SCRAPYARD/website%20new/non%20fight%20pictures/FB_IMG_1629559002285_qc0iul.jpg",
    "https://res.cloudinary.com/dpytkhyme/image/upload/v1691668061/STREETBEEFS%20SCRAPYARD/website%20new/non%20fight%20pictures/firechicken/FB_IMG_1659965707317_gmvfid.jpg",
  ];

  // Divide images into columns
  const columns = imageUrls.reduce<string[][]>((acc, url, index) => {
    const colIndex = index % 3;
    if (!acc[colIndex]) acc[colIndex] = [];
    acc[colIndex].push(url);
    return acc;
  }, []);

  return (
    <Container className=" p-1" index={0} key={columns.length} as="div">
      <FlexContainer
        layoutType="flex"
        flexDirection="row"
        justifyContent="start"
        alignItems="start"
        index={0}
        className=" max-w-screen-sm flex-wrap md:max-w-screen-md lg:max-w-screen-lg lg:flex-nowrap"
        breakpoints={{
          sm: "flex-col",
          md: "flex-row",
          lg: "flex-row-reverse",
        }}
      >
        <Field className=" max-w-md md:max-w-lg lg:max-w-xl xl:max-w-2xl">
          <Heading
            id="about-heading"
            as={"h1"}
            className="text-scrapGreen dark:text-scrapRed p-3 text-3xl lg:text-5xl "
          >
            We are the largest outdoor fight organization in the country
          </Heading>
          <Paragraph className="text-scrapYellow dark:text-scrapOrange p-3 text-xl lg:text-2xl">
            Witness everyday people settle disputes and showcase their skills in
            the ring where fists do the talking.
          </Paragraph>
        </Field>

        <Field className="w-1/2 max-w-xs lg:max-w-lg xl:max-w-xl">
          {/* Render columns */}
          <FlexContainer
            index={0}
            layoutType="flex"
            layoutStyle={3}
            flexDirection="row-reverse"
            justifyContent="end"
            alignItems="center"
          >
            {columns.map((columnImages, columnIndex) => (
              <Field
                key={columnIndex}
                className={` ${columnIndex % 6 === 0 ? "mt-12" : "mb-12"}`}
              >
                {columnImages.map((src, imgIndex) => (
                  <Field
                    key={imgIndex}
                    ref={(el) => {
                      if (el) {
                        el.style.setProperty("scroll-snap-align", "start");
                      }
                    }}
                  >
                    <Image
                      key={imgIndex}
                      src={src}
                      alt={`Image ${imgIndex}`}
                      width={150}
                      height={150}
                      className=" bg-scrapBlack/5 ml-0 mt-5 rounded-xl object-contain shadow-lg lg:ml-20"
                    />
                  </Field>
                ))}
              </Field>
            ))}
          </FlexContainer>
        </Field>
      </FlexContainer>
    </Container>
  );
};

export default AboutHeader;
