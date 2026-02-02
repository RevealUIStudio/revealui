// Temporary component stubs until proper components are added to @revealui/presentation
const Link = ({ href, className, children }: any) => (
  <a href={href} className={className}>{children}</a>
)

const Image = ({ src, alt, className }: any) => (
  <img src={src} alt={alt} className={className} />
)

const SVG = ({ children, viewBox, className }: any) => (
  <svg viewBox={viewBox} className={className}>{children}</svg>
)

const Path = ({ fill, fillOpacity, d }: any) => (
  <path fill={fill} fillOpacity={fillOpacity} d={d} />
)

const Stop = ({ stopColor, offset }: any) => (
  <stop stopColor={stopColor} offset={offset} />
)

const Container = ({ children, className }: any) => (
  <div className={className}>{children}</div>
)

const Field = ({ children, className }: any) => (
  <div className={className}>{children}</div>
)

const Heading = ({ children, id, className }: any) => (
  <h2 id={id} className={className}>{children}</h2>
)

const Paragraph = ({ children, className }: any) => (
  <p className={className}>{children}</p>
)

const MusicSection = (): React.ReactElement => {
  return (
    <Container className="bg-scrapBlack relative ">
      <Field className="bg-scrapBlack relative h-80 overflow-hidden rounded-xl brightness-100 md:absolute md:left-0 md:h-full md:w-1/3 lg:w-1/2">
        <Image
          className="size-full rounded-xl object-cover brightness-150"
          src="https://res.cloudinary.com/dpytkhyme/image/upload/v1693437335/scrap_records_logo_sdwhr8.png"
          alt=""
        />
        <SVG
          viewBox="0 0 926 676"
          className="-bottom-24 left-24 w-[57.875rem] transform-gpu blur-[118px]"
        >
          <Path
            fill="url(#music-section-gradient)"
            fillOpacity=".5"
            d="m254.325 516.708-90.89 158.331L0 436.427l254.325 80.281 163.691-285.15c1.048 131.759 36.144 345.144 168.149 144.613C751.171 125.508 707.17-93.823 826.603 41.15c95.546 107.978 104.766 294.048 97.432 373.585L685.481 297.694l16.974 360.474-448.13-141.46Z"
          />

          <linearGradient
            id="music-section-gradient"
            x1="926.392"
            x2="-109.635"
            y1=".176"
            y2="321.024"
            gradientUnits="userSpaceOnUse"
          >
            <Stop stopColor="#020617" offset="0%" />
            <Stop stopColor="#ea580c" />
            <Stop offset="100%" stopColor="#c82423" />
          </linearGradient>
        </SVG>
      </Field>
      <Container className="relative mx-auto max-w-7xl py-24 sm:py-32 lg:px-8 lg:py-40">
        <Field className="px-6 md:ml-auto md:w-2/3 md:pl-16 lg:w-1/2 lg:pl-24 lg:pr-0 xl:pl-32">
          <Heading
            id="artist-heading"
            className="text-scrapWhite text-base font-semibold leading-6"
          >
            Are you an artist?
          </Heading>
          <Paragraph className="text-scrapWhite mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            Want to be featured on Scrap Records?
          </Paragraph>
          <Paragraph className="text-scrapWhite mt-6 text-base leading-6">
            We are looking for artists to feature on our label. If you are interested in being
            featured on Scrap Records, please visit our help center for more information.
          </Paragraph>
          <Field className="mt-8">
            <Link
              href="/"
              className="bg-scrapWhite/10 inline-flex rounded-md px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Get started
            </Link>
          </Field>
        </Field>
      </Container>
    </Container>
  )
}

export default MusicSection
