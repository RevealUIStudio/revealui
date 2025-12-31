import React from "react";

const roadmap = [
  {
    id: 1,
    date: "2021 Q3",
    title: "Brainwave Launch",
    text: "Brainwave unlocks the potential of AI-powered applications",
    imageUrl: "https://via.placeholder.com/628x426",
    status: "done",
    colorful: true,
  },
  {
    id: 2,
    date: "2021 Q4",
    title: "Photo enhancement",
    text: "Automatically enhance your photos using our AI app's photo editing feature. Try it now!",
    imageUrl: "https://via.placeholder.com/628x426",
    status: "done",
    colorful: false,
  },
  {
    id: 3,
    date: "2022 Q1",
    title: "Seamless Integration",
    text: "The world’s most powerful AI photo and video art generation engine. What will you create?",
    imageUrl: "https://via.placeholder.com/628x426",
    status: "in-progress",
    colorful: true,
  },
];
const brainwaveServices = [
  "Photo generating",
  "Photo enhance",
  "Seamless Integration",
];
const Gradient = () => {
  return (
    <div className="pointer-events-none absolute -left-40 top-0 size-[56.625rem] opacity-50 mix-blend-color-dodge">
      <img
        className="absolute left-1/2 top-1/2 h-[88.5625rem] w-[79.5625rem] max-w-[79.5625rem] -translate-x-1/2 -translate-y-1/2 bg-inherit bg-gradient-to-t"
        src={""}
        width={1417}
        height={1417}
        alt="Gradient"
      />
    </div>
  );
};
const Generating = ({ className }: { className: string }) => {
  return (
    <div
      className={`bg-n-8/80 flex h-14 items-center rounded-[1.7rem] px-6 ${
        className || ""
      } text-base`}
    >
      <img className="mr-4 size-5" src={""} alt="Loading" />
      AI is generating
    </div>
  );
};
const brackets = (position: string) =>
  position === "left" ? (
    <svg
      width="5"
      height="14"
      viewBox="0 0 5 14"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M5 0.822266H1V12.8223H5" stroke="url(#brackets-left)" />
      <defs>
        <linearGradient id="brackets-left" x1="50%" x2="50%" y1="0%" y2="100%">
          <stop offset="0%" stopColor="#89F9E8" />
          <stop offset="100%" stopColor="#FACB7B" />
        </linearGradient>
      </defs>
    </svg>
  ) : (
    <svg
      width="5"
      height="14"
      viewBox="0 0 5 14"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M-2.98023e-08 0.822266H4V12.8223H-2.98023e-08"
        stroke="url(#brackets-right)"
      />
      <defs>
        <linearGradient
          id="brackets-right"
          x1="14.635%"
          x2="14.635%"
          y1="0%"
          y2="100%"
        >
          <stop offset="0%" stopColor="#9099FC" />
          <stop offset="100%" stopColor="#D87CEE" />
        </linearGradient>
      </defs>
    </svg>
  );
const Section = ({
  className,
  id,
  crosses,
  crossesOffset,
  customPaddings,
  children,
}: {
  className: string;
  id: string;
  crosses: boolean;
  crossesOffset: string;
  customPaddings: string;
  children: React.ReactNode;
}) => {
  return (
    <div
      id={id}
      className={`
        relative 
        ${
          customPaddings ||
          `py-10 lg:py-16 xl:py-20 ${crosses ? "lg:py-32 xl:py-40" : ""}`
        } 
        ${className || ""}`}
    >
      {children}

      <div className="w-0.25 bg-stroke-1 lg:left-7.5 pointer-events-none absolute left-5 top-0 hidden h-full md:block xl:left-10" />
      <div className="w-0.25 bg-stroke-1 lg:right-7.5 pointer-events-none absolute right-5 top-0 hidden h-full md:block xl:right-10" />

      {crosses && (
        <>
          <div
            className={`left-7.5 right-7.5 h-0.25 bg-stroke-1 absolute top-0 hidden ${
              crossesOffset && crossesOffset
            } pointer-events-none right-10 lg:block xl:left-10`}
          />
          {/* <SectionSvg crossesOffset={crossesOffset} /> */}
        </>
      )}
    </div>
  );
};
const Heading = ({
  className,
  title,
  text,
  tag,
}: {
  className: string;
  title: string;
  text: string;
  tag: string;
}) => {
  return (
    <div
      className={`${className} mx-auto mb-12 max-w-[50rem] md:text-center lg:mb-20`}
    >
      {tag && <TagLine className="mb-4 md:justify-center">{tag}</TagLine>}
      {title && <h2 className="h2">{title}</h2>}
      {text && <p className="body-2 text-n-4 mt-4">{text}</p>}
    </div>
  );
};

const TagLine = ({
  className,
  children,
}: {
  className: string;
  children: React.ReactNode;
}) => {
  return (
    <div className={`tagline flex items-center ${className || ""}`}>
      {brackets("left")}
      <div className="text-n-3 mx-3">{children}</div>
      {brackets("right")}
    </div>
  );
};

const Roadmap = () => (
  <Section
    className="overflow-hidden"
    id="roadmap"
    crosses={false}
    crossesOffset={""}
    customPaddings={""}
  >
    <div className="container md:pb-10">
      <Heading
        tag="Ready to get started"
        title="What we're working on"
        className={""}
        text={""}
      />

      <div className="relative grid gap-6 md:grid-cols-2 md:gap-4 md:pb-28">
        {roadmap.map((item) => {
          const status = item.status === "done" ? "Done" : "In progress";

          return (
            <div
              className={`p-0.25 rounded-[2.5rem] md:flex even:md:translate-y-28 ${
                item.colorful ? "bg-conic-gradient" : "bg-n-6"
              }`}
              key={item.id}
            >
              <div className="bg-n-8 xl:p-15 relative overflow-hidden rounded-[2.4375rem] p-8">
                <div className="absolute left-0 top-0 max-w-full">
                  <img
                    className="w-full"
                    src={"https://via.placeholder.com/550x550"}
                    width={550}
                    height={550}
                    alt="Grid"
                  />
                </div>
                <div className="z-1 relative">
                  <div className="mb-8 flex max-w-[27rem] items-center justify-between md:mb-20">
                    <TagLine className={""}>{item.date}</TagLine>

                    <div className="bg-n-1 text-n-8 flex items-center rounded px-4 py-1">
                      <img
                        className="mr-2.5"
                        src={"https://via.placeholder.com/16x16"}
                        width={16}
                        height={16}
                        alt={status}
                      />
                      <div className="tagline">{status}</div>
                    </div>
                  </div>

                  <div className="-mx-15 -my-10 mb-10">
                    <img
                      className="w-full"
                      src={item.imageUrl}
                      width={628}
                      height={426}
                      alt={item.title}
                    />
                  </div>
                  <h4 className="h4 mb-4">{item.title}</h4>
                  <p className="body-2 text-n-4">{item.text}</p>
                </div>
              </div>
            </div>
          );
        })}

        <Gradient />
      </div>

      <div className="md:mt-15 mt-12 flex justify-center xl:mt-20">
        <a href="/roadmap">Our roadmap</a>
      </div>
    </div>
  </Section>
);

const EventsContent: React.FC = () => {
  return (
    <>
      <Section
        id="how-to-use"
        className="bg-n-7 border-n-1/10 mx-auto border-y"
        crosses={true}
        crossesOffset="right-10"
        customPaddings="py-16 lg:py-20 xl:py-24"
      >
        <div className="container">
          <Heading
            title="Generative AI made for creators."
            text="Brainwave unlocks the potential of AI-powered applications"
            className={""}
            tag={""}
          />

          <div className="relative">
            <div className="z-1 border-n-1/10 relative mb-5 flex h-[39rem] items-center overflow-hidden rounded-3xl border p-8 lg:p-20 xl:h-[46rem]">
              <div className="pointer-events-none absolute left-0 top-0 size-full md:w-3/5 xl:w-auto">
                <img
                  className="size-full object-cover md:object-right"
                  width={800}
                  alt="Smartest AI"
                  height={730}
                  src={""}
                />
              </div>

              <div className="z-1 relative ml-auto max-w-[17rem]">
                <h4 className="h4 mb-4">Smartest AI</h4>
                <p className="body-2 text-n-3 mb-12">
                  Brainwave unlocks the potential of AI-powered applications
                </p>
                <ul className="body-2">
                  {brainwaveServices.map((item, index) => (
                    <li
                      key={index}
                      className="border-n-6 flex items-start border-t py-4"
                    >
                      <img width={24} height={24} alt="" src={""} />
                      <p className="ml-4">{item}</p>
                    </li>
                  ))}
                </ul>
              </div>

              <Generating className="border-n-1/10 lg-right-auto absolute inset-x-4 bottom-4 border lg:bottom-8 lg:left-1/2 lg:-translate-x-1/2" />
            </div>

            <div className="z-1 relative grid gap-5 lg:grid-cols-2">
              <div className="border-n-1/10 relative min-h-[39rem] overflow-hidden rounded-3xl border">
                <div className="absolute inset-0">
                  <img
                    src={""}
                    className="size-full object-cover"
                    width={630}
                    height={750}
                    alt="robot"
                  />
                </div>

                <div className="from-n-8/0 to-n-8/90 lg:p-15 absolute inset-0 flex flex-col justify-end bg-gradient-to-b p-8">
                  <h4 className="h4 mb-4">Photo editing</h4>
                  <p className="body-2 text-n-3 mb-12">
                    Automatically enhance your photos using our AI app&apos;s
                    photo editing feature. Try it now!
                  </p>
                </div>

                {/* <PhotoChatMessage /> */}
              </div>

              <div className="bg-n-7 overflow-hidden rounded-3xl p-4 lg:min-h-[46rem]">
                <div className="px-4 py-12 xl:px-8">
                  <h4 className="h4 mb-4">Video generation</h4>
                  <p className="body-2 text-n-3 mb-8">
                    The world’s most powerful AI photo and video art generation
                    engine. What will you create?
                  </p>

                  <ul className="flex items-center justify-between">
                    {/* {brainwaveServicesIcons.map((item, index) => (
      <li
        key={index}
        className={`flex items-center justify-center rounded-2xl ${
          index === 2
            ? "p-0.25 bg-conic-gradient size-12 md:size-[4.5rem]"
            : "bg-n-6 md:w-15 md:h-15 flex size-10"
        }`}
      >
        <div
          className={
            index === 2
              ? "bg-n-7 flex size-full items-center justify-center rounded-2xl"
              : ""
          }
        >
          <img src={item} width={24} height={24} alt={item} />
        </div>
      </li>
    ))} */}
                  </ul>
                </div>

                <div className="bg-n-8 relative h-80 overflow-hidden rounded-xl md:h-[25rem]">
                  <img
                    src={"https://via.placeholder.com/520x400"}
                    className="size-full object-cover"
                    width={520}
                    height={400}
                    alt="Scary robot"
                  />

                  {/* <VideoChatMessage />
    <VideoBar /> */}
                </div>
              </div>
            </div>

            <Gradient />
          </div>
        </div>
      </Section>
      <Roadmap />
    </>
  );
};

export default EventsContent;
