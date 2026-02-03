import type { Route } from '@revealui/router'
import React from 'react'

// Home Page
import {
  HomeBackground,
  HomeCard,
  HomeContent,
  HomeHeader,
  HomeHero,
  HomeMain,
  HomeSection,
} from './components/Home/index'
import { Builder } from './components/Builder/Builder'

function HomePage(): React.ReactElement {
  const [showBuilder, setShowBuilder] = React.useState(false)

  if (showBuilder) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          <header className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">RevealUI Builder</h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-6">
              Create beautiful applications without coding. Drag, drop, and deploy to Vercel
              instantly.
            </p>
            <button
              onClick={() => setShowBuilder(false)}
              type="button"
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              ← Back to Home
            </button>
          </header>
          <Builder />
        </div>
      </div>
    )
  }

  return (
    <HomeBackground>
      <HomeHeader />

      <div className="text-center mb-8">
        <button
          onClick={() => setShowBuilder(true)}
          type="button"
          className="px-8 py-4 bg-blue-600 text-white text-xl font-bold rounded-lg hover:bg-blue-700 transition-colors"
        >
          🚀 Try the Visual Builder
        </button>
      </div>

      <HomeCard />
      <HomeSection />
      <HomeMain />
      <HomeHero />
      <HomeContent />
    </HomeBackground>
  )
}

// About Page
import {
  AboutBackground,
  AboutCard,
  AboutContent,
  AboutHeader,
  AboutHero,
  AboutMain,
  AboutSection,
} from './components/About/index'

function AboutPage(): React.ReactElement {
  return (
    <AboutBackground>
      <AboutHeader />
      <AboutHero />
      <AboutMain />
      <AboutSection />
      <AboutContent />
      <AboutCard />
    </AboutBackground>
  )
}

// Events Page
import {
  EventsBackground,
  EventsCard,
  EventsHeader,
  EventsHero,
  EventsMain,
  EventsSection,
} from './components/Events/index'

function EventsPage(): React.ReactElement {
  return (
    <EventsBackground>
      <EventsHeader />
      <EventsMain />
      <EventsSection />
      <EventsHero />
      <EventsCard />
    </EventsBackground>
  )
}

// Fighters Page
import {
  FightersBackground,
  FightersHeader,
  FightersHero,
  FightersSection,
} from './components/Fighters/index'

function FightersPage(): React.ReactElement {
  return (
    <FightersBackground index={0}>
      <FightersHeader />
      <FightersHero />
      <FightersSection />
    </FightersBackground>
  )
}

// Game Page (simple stub)
function GamePage(): React.ReactElement {
  return <h1>game</h1>
}

// Media Page (uses Music components)
import {
  MusicBackground,
  MusicContent,
  MusicHeader,
  MusicMain,
  MusicSection,
} from './components/Music/index'

interface MusicTrack {
  id: string
  name: string
  title: string
  artist: string
  cover: string
  audio: string
  captions: string
  color: string[]
  active: boolean
}

function MediaPage(): React.ReactElement {
  const music: MusicTrack[] = [
    {
      id: '1',
      name: 'Street Beats',
      title: 'Street Beats',
      artist: 'J Gottem',
      cover:
        'https://res.cloudinary.com/dpytkhyme/image/upload/v1693437335/scrap_records_logo_sdwhr8.png',
      audio:
        'https://isrnomxlkzfngwebohyx.supabase.co/storage/v1/object/public/songs/J%20Gottem%20-%20Street%20Beats.mp3?t=2023-09-17T08%3A02%3A14.135Z',
      captions: 'captions ',
      color: [],
      active: false,
    },
    {
      id: '2',
      name: 'Scrapyard Anthem',
      title: 'Scrapyard Anthem',
      artist: 'Ronin',
      cover:
        'https://res.cloudinary.com/dpytkhyme/image/upload/v1693437335/scrap_records_logo_sdwhr8.png',
      audio:
        'https://isrnomxlkzfngwebohyx.supabase.co/storage/v1/object/public/songs/Scrapyard%20anthem(LLJG).mp3',
      captions: 'captions ',
      color: [],
      active: false,
    },
    {
      id: '3',
      name: 'STREETBEEFS SCRAPYARD',
      title: 'STREETBEEFS SCRAPYARD',
      artist: 'Chase Money feat. E.D.D.I.E. & Cadderson',
      cover:
        'https://res.cloudinary.com/dpytkhyme/image/upload/v1693437335/scrap_records_logo_sdwhr8.png',
      audio:
        'https://isrnomxlkzfngwebohyx.supabase.co/storage/v1/object/public/songs/STREETBEEFS%20SCRAPYARD.mp3',
      captions: 'captions ',
      color: [],
      active: false,
    },
  ]

  return (
    <MusicBackground>
      <MusicHeader />
      <MusicMain />
      <MusicContent
        songs={music.map((track) => ({
          id: track.id,
          title: track.title,
          name: track.title,
          artist: track.artist,
          cover: track.cover,
          audio: track.audio,
          captions: track.captions,
          color: [],
          active: false,
        }))}
      />
      <MusicSection />
    </MusicBackground>
  )
}

// Todos Page
import { TodosPage } from './components/Todos/TodosPage'

// Temporary component replacements until proper components are created
const Container = ({ className, children }: { className?: string; children: React.ReactNode }) => (
  <div className={className}>{children}</div>
)
const Field = ({ className, children }: { className?: string; children: React.ReactNode }) => (
  <div className={className}>{children}</div>
)
const FlexContainer = ({ className, children }: { className?: string; children: React.ReactNode }) => (
  <div className={className}>{children}</div>
)
const GridContainer = ({ className, children }: { className?: string; children: React.ReactNode }) => (
  <div className={className}>{children}</div>
)
const Heading = ({ id, as, className, children }: { id?: string; as?: string; className?: string; children: React.ReactNode }) => {
  const Component = as || 'h2'
  return React.createElement(Component as any, { id, className }, children)
}
const Text = ({ className, children }: { className?: string; children: React.ReactNode }) => (
  <p className={className}>{children}</p>
)
const Button = ({ type, className, children, ...props }: { type?: 'button' | 'submit'; className?: string; children: React.ReactNode; [key: string]: any }) => (
  <button type={type || 'button'} className={className} {...props}>{children}</button>
)
const ImageGrid = ({ className, images }: { className?: string; images: any[] }) => (
  <div className={className}>
    {images.map((img) => (
      <img key={img.id} src={img.image} alt={img.alt} />
    ))}
  </div>
)

function SupportPage(): React.ReactElement {
  const product = {
    name: 'VIP Access',
    href: '/',
    price: 100.0,
    rating: 5,
    breadcrumbs: [
      { id: 1, name: 'Bundles', href: '/' },
      { id: 2, name: 'Basic', href: '/' },
    ],
    images: [
      {
        id: '1',
        image:
          'https://res.cloudinary.com/dpytkhyme/image/upload/v1686557282/STREETBEEFS%20SCRAPYARD/firechicken_animated_photo_fj1xej.jpg',
        alt: '',
      },
    ],
    colors: [
      { name: 'Washed Black', value: '#6C6C6C' },
      { name: 'Washed gray', value: '#F7F0EA' },
      { name: 'White', value: '#FFFFFF' },
    ],
    sizes: [
      { name: 'XL', selectedSize: 'xl' },
      { name: 'L', selectedSize: 'l' },
      { name: 'M', selectedSize: 'm' },
      { name: 'S', selectedSize: 's' },
      { name: 'XS', selectedSize: 'xs' },
    ],
    description:
      'The Scrapyard video game is a fighting game featuring all of your favorite STREETBEEFS SCRAPYARD YouTube channel fighters',
    details: [
      {
        name: 'Features',
        items: [
          'Multiple button configurations',
          'Assist mode',
          'Online multiplayer',
          'Local multiplayer',
          'Story mode',
          'Arcade mode',
          'Training mode',
        ],
      },
    ],
  }

  return (
    <Container className="bg-scrapGreen/60 lg:max-w-8xl mx-auto w-full max-w-2xl p-2 sm:px-6 lg:px-2 ">
      <GridContainer className="w-full lg:grid-flow-row lg:grid-cols-2">
        <Field>
          <Heading id="product-title" as={'h1'} className="text-scrapBlack text-3xl font-medium">
            {product.name}
          </Heading>
          <Text className="text-scrapBlack text-3xl font-medium">${product.price}</Text>

          <GridContainer>
            <Text className=" text-scrapBlack py-4 font-medium lg:text-lg">
              Currently in Development and Testing Phase & with enough donations we can make this a
              reality sooner!
            </Text>

            <Field className="prose prose-sm lg:prose-lg text-scrapWhite py-2">
              <Text className="text-scrapBlack text-2xl font-bold">
                {product.description}
              </Text>
            </Field>

            <FlexContainer className="flex flex-col items-start justify-start py-4">
              <Text className="text-scrapBlack text-2xl font-bold">{product.price}</Text>
              <Text className="text-scrapBlack text-sm font-medium">
                {product.description}
              </Text>

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
  )
}

// Builder Page
function BuilderPage(): React.ReactElement {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">RevealUI Builder</h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-6">
            Create beautiful applications without coding. Drag, drop, and deploy to Vercel
            instantly.
          </p>
        </header>
        <Builder />
      </div>
    </div>
  )
}

// Music Page (similar to Media)
function MusicPage(): React.ReactElement {
  const music: MusicTrack[] = [
    {
      id: '1',
      name: 'Street Beats',
      title: 'Street Beats',
      artist: 'J Gottem',
      cover:
        'https://res.cloudinary.com/dpytkhyme/image/upload/v1693437335/scrap_records_logo_sdwhr8.png',
      audio:
        'https://isrnomxlkzfngwebohyx.supabase.co/storage/v1/object/public/songs/J%20Gottem%20-%20Street%20Beats.mp3?t=2023-09-17T08%3A02%3A14.135Z',
      captions: 'captions ',
      color: [],
      active: false,
    },
  ]

  return (
    <MusicBackground>
      <MusicHeader />
      <MusicMain />
      <MusicContent songs={music} />
      <MusicSection />
    </MusicBackground>
  )
}

// RPC Demo Page
function RpcDemoPage(): React.ReactElement {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">RPC Demo</h1>
        <p className="text-lg text-gray-600">
          This is a placeholder for the RPC demo page.
        </p>
      </div>
    </div>
  )
}

// Define all routes
export const routes: Route[] = [
  {
    path: '/',
    component: HomePage,
    meta: { title: 'Home - RevealUI' },
  },
  {
    path: '/about',
    component: AboutPage,
    meta: { title: 'About - RevealUI' },
  },
  {
    path: '/events',
    component: EventsPage,
    meta: { title: 'Events - RevealUI' },
  },
  {
    path: '/fighters',
    component: FightersPage,
    meta: { title: 'Fighters - RevealUI' },
  },
  {
    path: '/game',
    component: GamePage,
    meta: { title: 'Game - RevealUI' },
  },
  {
    path: '/media',
    component: MediaPage,
    meta: { title: 'Media - RevealUI' },
  },
  {
    path: '/support',
    component: SupportPage,
    meta: { title: 'Support - RevealUI' },
  },
  {
    path: '/builder',
    component: BuilderPage,
    meta: { title: 'Builder - RevealUI' },
  },
  {
    path: '/music',
    component: MusicPage,
    meta: { title: 'Music - RevealUI' },
  },
  {
    path: '/rpc-demo',
    component: RpcDemoPage,
    meta: { title: 'RPC Demo - RevealUI' },
  },
  {
    path: '/todos',
    component: TodosPage,
    meta: { title: 'Todos - RevealUI' },
  },
]
