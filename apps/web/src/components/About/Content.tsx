import type React from 'react'

// Temporary component stubs until proper components are added to @revealui/presentation
const Link = ({ href, className, children }: any) => (
  <a href={href} className={className}>{children}</a>
)

const Image = ({ src, alt, className, width, height }: any) => (
  <img src={src} alt={alt} className={className} width={width} height={height} />
)

const SVG = ({ children, className, viewBox, x, y }: any) => (
  <svg className={className} viewBox={viewBox} x={x} y={y}>{children}</svg>
)

const Circle = ({ cx, cy, r }: any) => (
  <circle cx={cx} cy={cy} r={r} />
)

const Defs = ({ children }: any) => <defs>{children}</defs>

const Path = ({ d, fill, stroke, strokeWidth, fillOpacity }: any) => (
  <path d={d} fill={fill} stroke={stroke} strokeWidth={strokeWidth} fillOpacity={fillOpacity} />
)

const Pattern = ({ children, id, width, height, x, y, patternUnits, patternTransform }: any) => (
  <pattern id={id} width={width} height={height} x={x} y={y} patternUnits={patternUnits} patternTransform={patternTransform}>
    {children}
  </pattern>
)

const Rect = ({ width, height, strokeWidth, fill, className }: any) => (
  <rect width={width} height={height} strokeWidth={strokeWidth} fill={fill} className={className} />
)

const DescriptionList = ({ items, id, className, name, description }: any) => (
  <dl id={id} className={className}>
    {name && <dt style={{ fontWeight: 'bold' }}>{name}</dt>}
    {description && <dd>{description}</dd>}
    {items && items.map((item: any) => (
      <div key={item.id}>
        <dt style={{ fontWeight: 'bold' }}>{item.name}</dt>
        <dd>{item.description}</dd>
      </div>
    ))}
  </dl>
)

const Li = ({ children }: any) => <li>{children}</li>

const List = ({ children, type, className }: any) => {
  const Tag = type === 'ul' ? 'ul' : 'ol'
  return <Tag className={className}>{children}</Tag>
}

const UList = ({ items, type, className }: any) => {
  const Tag = type === 'ul' ? 'ul' : 'ol'
  return <Tag className={className}>{items}</Tag>
}

const Field = ({ children, className, ref, style }: any) => (
  <div className={className} ref={ref} style={style}>{children}</div>
)

const FlexContainer = ({ children, className, index, layoutType, flexDirection, justifyContent, alignItems, breakpoints, layoutStyle }: any) => (
  <div className={className}>{children}</div>
)

const GridContainer = ({ children, className, index }: any) => (
  <div className={className}>{children}</div>
)

const Container = ({ children, className, index, as, style }: any) => {
  const Tag = as || 'div'
  return <Tag className={className} style={style}>{children}</Tag>
}

const Heading = ({ children, id, as = 'h2', className, variant }: any) => {
  const Tag = as
  return <Tag id={id} className={className}>{children}</Tag>
}

const Paragraph = ({ children, className }: any) => (
  <p className={className}>{children}</p>
)

const Time = ({ children, item, className }: any) => (
  <time dateTime={item?.dateTime} className={className}>{children || item?.date}</time>
)

const Article = ({ children, className, title, content }: any) => (
  <article className={className} title={title}>{children}</article>
)

const Span = ({ children, className }: any) => (
  <span className={className}>{children}</span>
)

export default function AboutContent(): React.ReactElement {
  return (
    <Container>
      <CtaSection />

      <MissionStats />

      <WideImageSection />

      <ValuesSection />

      <LogoCloud />

      <TeamSection />

      <BlogCardsSection />
    </Container>
  )
}

const CtaSection = () => {
  const ctaList = [
    {
      id: '1',
      name: 'Check us out',
      description:
        'Streetbeefs Scrapyard is a place where you can test your metal. Get some training in, or just come to watch the fights.',
    },
  ]
  return (
    <Container>
      <SVG
        className="stroke-scrapWhite/40 absolute inset-x-0 top-0 -z-10 h-[64rem] w-full [mask-image:radial-gradient(32rem_32rem_at_center,white,transparent)]"
        aria-hidden="true"
      >
        <Defs>
          <Pattern
            id="1f932ae7-37de-4c0a-a8b0-a6e3b4d44b84"
            width={200}
            height={200}
            x="50%"
            y={-1}
            patternUnits="userSpaceOnUse"
          >
            <Path d="M.5 200V.5H200" fill="none" />
          </Pattern>
        </Defs>
        <SVG x="50%" y={-1} className="fill-scrapOrange overflow-visible">
          <Path
            d="M-200 0h201v201h-201Z M600 0h201v201h-201Z M-400 600h201v201h-201Z M200 800h201v201h-201Z"
            strokeWidth={0}
          />
        </SVG>
        <Rect
          width="100%"
          height="100%"
          strokeWidth={0}
          fill="url(#1f932ae7-37de-4c0a-a8b0-a6e3b4d44b84)"
        />
      </SVG>
      <Field
        className="absolute left-1/2 right-0 top-0 -z-10 -ml-24 transform-gpu overflow-hidden blur-3xl lg:ml-24 xl:ml-48"
        aria-hidden="true"
      >
        <Container
          className="from-scrapRed to-scrapYellow aspect-[801/1036] w-[50.0625rem] bg-gradient-to-tr opacity-30"
          style={{
            clipPath:
              'polygon(63.1% 29.5%, 100% 17.1%, 76.6% 3%, 48.4% 0%, 44.6% 4.7%, 54.5% 25.3%, 59.8% 49%, 55.2% 57.8%, 44.4% 57.2%, 27.8% 47.9%, 35.1% 81.5%, 0% 97.7%, 39.2% 100%, 35.2% 81.4%, 97.2% 52.8%, 63.1% 29.5%)',
          }}
        />
      </Field>

      <Container className="xl:max-w-8xl mx-auto max-w-xl px-6 pb-32 pt-36 lg:max-w-6xl lg:px-8 lg:pt-32">
        <FlexContainer className="max-w-2xl flex-col gap-x-10 lg:max-w-6xl lg:flex-row lg:items-center">
          <Field className="w-full max-w-lg p-3 lg:shrink-0 xl:max-w-2xl">
            <Heading
              as={'h1'}
              id="content-title"
              className="prose-h1 text-scrapWhite dark:text-scrapOrange text-4xl font-bold tracking-tight lg:text-6xl"
            >
              {ctaList[0]?.name || 'RevealUI'}
            </Heading>
            <Paragraph className="prose-p text-scrapWhite dark:text-scrapOrange xl:max-w-8xl relative mt-6 text-lg leading-6 sm:max-w-md lg:max-w-6xl">
              {ctaList[0]?.description || 'Build amazing experiences'}
            </Paragraph>
          </Field>
          <Container className="mt-14 flex justify-end gap-8 sm:-mt-44 sm:justify-start sm:pl-20 lg:mt-0 lg:pl-0">
            <Container className="ml-auto w-44 flex-none space-y-8 pt-32 sm:ml-0 sm:pt-80 lg:order-last lg:pt-36 xl:order-none xl:pt-80">
              <Container className="relative">
                <Image
                  src="https://res.cloudinary.com/dpytkhyme/image/upload/v1685511809/STREETBEEFS%20SCRAPYARD/art/1679451752690_xw60wm.jpg"
                  alt=""
                  className="bg-scrapWhite/5 dark:bg-scrapBlack/5 aspect-[2/3] w-full rounded-xl object-cover shadow-lg"
                />
                <Field className="ring-scrapBlack/10 dark:ring-scrapWhite/10 pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset " />
              </Container>
            </Container>
            <Container className="mr-auto w-44 flex-none space-y-8 sm:mr-0 sm:pt-52 lg:pt-36">
              <Container className="relative">
                <Image
                  src="https://res.cloudinary.com/dpytkhyme/image/upload/v1699256475/STREETBEEFS%20SCRAPYARD/image000000_vba8rb.jpg"
                  alt=""
                  className="bg-scrapWhite/5 dark:bg-scrapBlack/5 aspect-[2/3] w-full rounded-xl object-cover shadow-lg"
                />
                <Field className="ring-scrapBlack/10 dark:ring-scrapWhite/10 pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset " />
              </Container>
              <Container className="relative">
                <Image
                  src="https://res.cloudinary.com/dpytkhyme/image/upload/v1699256475/STREETBEEFS%20SCRAPYARD/image000001_x2jbnc.jpg"
                  alt=""
                  className="bg-scrapWhite/5 dark:bg-scrapBlack/5 aspect-[2/3] w-full rounded-xl object-cover shadow-lg"
                />
                <Field className="ring-scrapBlack/10 dark:ring-scrapWhite/10 pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset " />
              </Container>
            </Container>
            <Container className="w-44 flex-none space-y-8 pt-32 sm:pt-0">
              <Container className="relative">
                <Image
                  src="https://res.cloudinary.com/dpytkhyme/image/upload/v1693892724/STREETBEEFS%20SCRAPYARD/148323328_497251397930736_5009547295968567863_n_1_g4onkj.jpg"
                  alt=""
                  className="bg-scrapWhite/5 dark:bg-scrapBlack/5 aspect-[2/3] w-full rounded-xl object-cover shadow-lg"
                />
                <Field className="ring-scrapBlack/10 dark:ring-scrapWhite/10 pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset " />
              </Container>
              <Container className="relative">
                <Image
                  src="https://res.cloudinary.com/dpytkhyme/image/upload/v1699256474/STREETBEEFS%20SCRAPYARD/image000002_sbcctc.jpg"
                  alt=""
                  className="bg-scrapWhite/5 dark:bg-scrapBlack/5 aspect-[2/3] w-full rounded-xl object-cover shadow-lg"
                />
                <Field className="ring-scrapBlack/10 dark:ring-scrapWhite/10 pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset " />
              </Container>
            </Container>
          </Container>
        </FlexContainer>
      </Container>
    </Container>
  )
}

const MissionStats = () => {
  const statsList = [
    { id: '4', name: 'Fights', description: '1000+' },
    { id: '5', name: 'Fighters', description: '100+' },
    { id: '6', name: 'Events', description: '20+' },
    { id: '7', name: 'Videos', description: '100+' },
  ]
  const missionFieldHeader = [
    {
      id: '3',
      name: 'Our mission',
      description:
        ' Here at the Scrapyard we are dedicated to providing a safe place for people to come and test their metal. Whether you are a seasoned fighter or just looking to get some training in, we have what you need.',
    },
  ]

  const missionContent = [
    {
      id: '1',
      info: ' Get to know us a little better. Whether you are a fighter or fan we have something for you. What are you waiting for? Come check us out.',
      description:
        ' We are always looking for new fighters. If you think you have what it takes, come on down and test your metal. When you are ready to fight, we will be here. However if you are just looking to get some training in, we have that too.',
    },
  ]
  return (
    <Container className="mx-auto px-6 lg:px-8">
      <Container className="mx-auto max-w-2xl lg:mx-0 lg:max-w-6xl">
        <Heading
          id={''}
          as={'h2'}
          className="prose-h2 text-scrapYellow dark:text-scrapOrange text-3xl font-bold tracking-tight sm:text-4xl"
        >
          {missionFieldHeader[0]?.name}
        </Heading>
        <FlexContainer className="flex-col justify-center gap-y-20 lg:flex-row">
          <Field className="lg:w-full lg:max-w-2xl">
            <Paragraph className="prose-p text-scrapWhite dark:text-scrapYellow text-xl leading-6">
              {missionFieldHeader[0]?.description}
            </Paragraph>
            <Field className=" max-w-xl leading-6 brightness-200 dark:brightness-150">
              <Paragraph className="prose-p text-scrapGreen dark:text-scrapBlue text-lg">
                {missionContent[0]?.info}
              </Paragraph>
              <Paragraph className="text-scrapBlue dark:text-scrapGreen prose-p text-base font-bold">
                {missionContent[0]?.description}
              </Paragraph>
            </Field>
          </Field>

          <DescriptionList className="place-content-start" id={''} items={statsList} />
        </FlexContainer>
      </Container>
    </Container>
  )
}

const WideImageSection = () => {
  return (
    <Field className="mt-12 lg:mt-20 xl:mx-auto xl:max-w-7xl xl:px-8">
      <Image
        src="https://res.cloudinary.com/dpytkhyme/image/upload/v1707597390/325501354_493211929666744_4004464282522655431_n_twn8qd.jpg"
        alt=""
        className="aspect-auto w-full object-cover xl:rounded-3xl"
      />
    </Field>
  )
}

const ValuesSection = () => {
  const values = [
    {
      id: '8',
      name: 'Safety',
      description:
        'We are dedicated to providing a safe place for people to come and test their metal.',
    },
    {
      id: '9',
      name: 'Training',
      description:
        'We are always looking for new fighters. If you think you have what it takes, come on down and test your metal.',
    },
    {
      id: '10',
      name: 'Dedication',
      description:
        'We are always looking for new fighters. If you think you have what it takes, come on down and test your metal.',
    },
    {
      id: '11',
      name: 'Community',
      description:
        'We are always looking for new fighters. If you think you have what it takes, come on down and test your metal.',
    },
  ]

  const listValues = values.map((value) => ({
    id: value.id,
    name: value.name,
    description: value.description,
  }))

  const valuesList = listValues.map((value) => (
    <DescriptionList
      key={value.name}
      id={value.id}
      name={value.name}
      description={value.description}
      items={listValues}
      className=" max-w-2xl lg:max-w-7xl"
    />
  ))
  const valuesFieldHeader = [
    {
      id: '12',
      name: 'Our values',
      description:
        'This is a place where you can test your metal. We are dedicated to providing a safe place for people to come and test their metal.',
    },
  ]
  const valuesName = valuesFieldHeader.map((value) => value.name)
  const valuesDescription = valuesFieldHeader.map((value) => value.description)
  return (
    <Container className="mx-auto mt-32 px-6 lg:px-8">
      <Field className="max-w-xl lg:max-w-5xl">
        <Field className="max-w-lg lg:max-w-2xl">
          <Heading
            id="values"
            as={'h3'}
            className="text-scrapYellow dark:text-scrapOrange tracking-loose text-4xl font-bold"
          >
            {valuesName}
          </Heading>
          <Paragraph className="text-scrapOrange dark:text-scrapRed text-lg leading-7">
            {valuesDescription}
          </Paragraph>
        </Field>

        {/* Values list */}

        <UList
          className="prose-ul text-scrapWhite px-2 text-sm lg:text-base"
          items={valuesList}
          type={'ul'}
        />
      </Field>
    </Container>
  )
}

const TeamSection = () => {
  const team = [
    {
      name: 'Steve Hagara',
      role: 'Owner, Fighter & CEO of the Scrapyard',
      imageUrl:
        'https://res.cloudinary.com/dpytkhyme/image/upload/v1707598201/Beast_Mode_bhfx4x.png',
    },
    {
      name: 'Scarface',
      role: 'Owner, Fighter & CEO of the OG Branch',
      imageUrl:
        'https://res.cloudinary.com/dpytkhyme/image/upload/v1707598201/Beast_Mode_bhfx4x.png',
    },
    {
      name: 'Anamoly',
      role: 'Referee & Fighter',
      imageUrl:
        'https://res.cloudinary.com/dpytkhyme/image/upload/v1707598201/Beast_Mode_bhfx4x.png',
    },
    {
      name: 'Araña',
      role: 'Referee & Fighter',
      imageUrl:
        'https://res.cloudinary.com/dpytkhyme/image/upload/v1707598201/Beast_Mode_bhfx4x.png',
    },
    {
      name: 'Solo',
      role: 'Promoter & Fighter',
      imageUrl:
        'https://res.cloudinary.com/dpytkhyme/image/upload/v1707598201/Beast_Mode_bhfx4x.png',
    },
  ]
  return (
    <Container className="mx-auto mt-20 max-w-7xl px-6 lg:mt-48 lg:px-8">
      <Field className="mx-auto max-w-2xl lg:mx-0">
        <Heading
          id="our-team"
          as={'h2'}
          className="text-scrapOrange dark:text-scrapRed text-3xl font-bold tracking-tight sm:text-4xl"
        >
          Our team
        </Heading>
        <Paragraph className="text-scrapWhite dark:text-scrapYellow text-lg leading-7 ">
          Collaborators are welcome to join our team. We are always looking for new fighters. If you
          think you have what it takes, come on down and test your metal.
        </Paragraph>
      </Field>

      <List type="ul" className="mx-auto mt-10 w-full text-center ">
        <GridContainer className="grid-cols-2 gap-x-8 gap-y-16 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {team.map((person) => (
            <Li key={person.name}>
              <Image
                className="mx-auto size-24 rounded-full"
                src={person.imageUrl}
                alt={person.imageUrl}
              />
              <Heading
                as={'h3'}
                className="text-scrapWhite dark:text-scrapYellow mt-6 text-base font-semibold leading-7 tracking-tight"
                id={person.name}
              >
                {person.name}
              </Heading>
              <Paragraph className="text-scrapOrange dark:text-scrapRed text-sm leading-6">
                {person.role}
              </Paragraph>
            </Li>
          ))}
        </GridContainer>
      </List>
    </Container>
  )
}

const LogoCloud = () => {
  return (
    <Container className="relative isolate -z-10 mt-32 lg:mt-48">
      <Field className="absolute inset-x-0 top-1/2 -z-10 flex -translate-y-1/2 justify-center overflow-hidden [mask-image:radial-gradient(50%_45%_at_50%_55%,white,transparent)]">
        <SVG
          className="stroke-scrapWhite/50 dark:stroke-scrapBlack/50 h-[40rem] w-[80rem] flex-none"
          aria-hidden="true"
        >
          <Defs>
            <Pattern
              id="e9033f3e-f665-41a6-84ef-756f6778e6fe"
              width={200}
              height={200}
              x="50%"
              y="50%"
              patternUnits="userSpaceOnUse"
              patternTransform="translate(-100 0)"
            >
              <Path d="M.5 200V.5H200" fill="none" />
            </Pattern>
          </Defs>
          <SVG x="50%" y="50%" className="fill-scrapWhite dark:fill-scrapBlack overflow-visible">
            <Path d="M-300 0h201v201h-201Z M300 200h201v201h-201Z" strokeWidth={0} />
          </SVG>
          <Rect
            width="100%"
            height="100%"
            strokeWidth={0}
            fill="url(#e9033f3e-f665-41a6-84ef-756f6778e6fe)"
          />
        </SVG>
      </Field>

      <Container className="mx-auto max-w-7xl px-6 lg:px-8">
        <Heading
          id=""
          as={'h2'}
          className="text-scrapWhite dark:text-scrapOrange mx-auto w-full max-w-4xl text-center text-2xl font-semibold leading-7"
        >
          Trusted fight brands and organizations that use our platform to grow their business and
          reach new customers.
        </Heading>
        <GridContainer className="mx-auto mt-10 max-w-lg grid-cols-4 items-center gap-x-8 gap-y-10 md:max-w-xl lg:max-w-6xl lg:grid-cols-5 lg:gap-x-10">
          <Image
            className="max-h-22 col-span-2 w-full rounded-full object-contain lg:col-span-1"
            src="https://res.cloudinary.com/dpytkhyme/image/upload/v1707598205/Game_time_pqvvc3.png"
            alt="Transistor"
            width={158}
            height={48}
          />
          <Image
            className="max-h-22 col-span-2 w-full rounded-full object-contain lg:col-span-1"
            src="https://res.cloudinary.com/dpytkhyme/image/upload/v1707598201/Beast_Mode_bhfx4x.png"
            alt="Reform"
            width={158}
            height={48}
          />
          <Image
            className="max-h-22 col-span-2 w-full rounded-full object-contain lg:col-span-1"
            src="https://res.cloudinary.com/dpytkhyme/image/upload/v1707598200/SY1_yob1jc.png"
            alt="Tuple"
            width={158}
            height={48}
          />
          <Image
            className="max-h-22 col-span-2 w-full rounded-full object-contain sm:col-start-2 lg:col-span-1"
            src="https://res.cloudinary.com/dpytkhyme/image/upload/v1707598193/Polish_20220602_155857367_iwm1j3.png"
            alt="SavvyCal"
            width={158}
            height={48}
          />
          <Image
            className="max-h-22 col-span-2 col-start-2 w-full rounded-full object-contain sm:col-start-auto lg:col-span-1"
            src="https://res.cloudinary.com/dpytkhyme/image/upload/v1699256475/STREETBEEFS%20SCRAPYARD/image000001_x2jbnc.jpg"
            alt="Statamic"
            width={158}
            height={48}
          />
        </GridContainer>
      </Container>
    </Container>
  )
}

const BlogCardsSection = () => {
  const blogPosts = [
    {
      id: 1,
      author: {
        name: 'Joshua V Stories',
        image:
          'https://res.cloudinary.com/dpytkhyme/image/upload/v1707599422/148336795_323799415739019_7193595648809676648_n_1_shqnuj.jpg',
      },
      image:
        'https://res.cloudinary.com/dpytkhyme/image/upload/v1699245361/STREETBEEFS%20SCRAPYARD/yardatnight_nahrxr.jpg',
      date: 'February 12, 2024',
      datetime: '2024-02-12',
      title: 'From Streetbeefs to Scrapyard',
      href: '/',
    },
    {
      id: 2,
      author: {
        name: 'Steve Hagara',
        image:
          'https://res.cloudinary.com/dpytkhyme/image/upload/v1699245361/STREETBEEFS%20SCRAPYARD/yardatnight_nahrxr.jpg',
      },
      image:
        'https://res.cloudinary.com/dpytkhyme/image/upload/v1699245361/STREETBEEFS%20SCRAPYARD/yardatnight_nahrxr.jpg',
      date: 'February 26, 2024',
      datetime: '2024-02-26',
      title: 'The Scrapyard is now open for business!',
      href: '/',
    },
  ]
  return (
    <Container className="mx-auto mt-2 px-6 lg:px-8">
      <GridContainer className="mx-auto my-16 max-w-2xl auto-rows-fr grid-cols-1 gap-8 lg:mx-0 lg:max-w-none lg:grid-cols-3">
        <Field className="mx-auto">
          <Heading
            id="experts"
            as={'h3'}
            className="text-scrapWhite dark:text-scrapYellow text-3xl font-bold tracking-tight sm:text-4xl"
          >
            From our experts
          </Heading>
          <Paragraph className="text-scrapYellow dark:text-scrapOrange mt-2 text-lg leading-7">
            Looking for some training? We have you covered. We are always looking for new fighters.
            If you think you have what it takes, come on down and test your metal.
          </Paragraph>
        </Field>
        {blogPosts.map((post) => (
          <Article
            key={post.id}
            className="bg-scrapWhite/20 dark:bg-scrapWhite/20 relative isolate flex flex-col justify-end overflow-hidden rounded-2xl px-8 pb-8 pt-48 lg:pt-80"
            title={post.title}
            content={post}
          >
            <Image
              src={post.image}
              alt=""
              className="absolute inset-0 -z-10 size-full object-cover"
            />
            <Field className="from-scrapOrange/10 via-scrapWhite/40 absolute inset-0 -z-10 bg-gradient-to-t" />
            <Field className="ring-scrapBlack/10 dark:ring-scrapWhite/40 absolute inset-0 -z-10 rounded-2xl ring-1 ring-inset " />

            <FlexContainer className="text-scrapWhite dark:text-scrapYellow flex-wrap items-center gap-y-1 overflow-hidden text-sm leading-6">
              <Time item={{ dateTime: post.datetime, date: post.date }} className="mr-8">
                {post.date}
              </Time>
              <Field className="-ml-4 flex items-center gap-x-4">
                <SVG
                  viewBox="0 0 2 2"
                  className="fill-scrapWhite/50 dark:fill-scrapBlack/50 -ml-1 size-1 flex-none"
                >
                  <Circle cx={1} cy={1} r={1} />
                </SVG>
                <FlexContainer className=" gap-x-2">
                  <Image
                    src={post.author.image}
                    alt=""
                    className="bg-scrapBlack/10 dark:bg-scrapWhite/10 size-6 flex-none rounded-full"
                  />
                  {post.author.name}
                </FlexContainer>
              </Field>
            </FlexContainer>
            <Paragraph className="text-scrapWhite dark:text-scrapOrange mt-3 text-lg font-semibold leading-6">
              <Link href={post.href}>{post.title}</Link>
            </Paragraph>
          </Article>
        ))}
      </GridContainer>
    </Container>
  )
}
