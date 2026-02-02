// Temporary component stubs until proper components are added to @revealui/presentation
const SongItem = ({ music }: any) => (
  <div style={{ padding: '1rem', border: '1px solid #ccc', marginBottom: '0.5rem' }}>
    <img src={music.cover} alt={music.title} style={{ width: '50px', height: '50px' }} />
    <div>
      <strong>{music.title}</strong> - {music.artist}
    </div>
    <audio controls src={music.audio} style={{ width: '100%' }} />
  </div>
)

const Container = ({ children, className }: any) => (
  <div className={className}>{children}</div>
)

const Field = ({ children, className }: any) => (
  <div className={className}>{children}</div>
)

const Heading = ({ children, id, as = 'h1', className }: any) => {
  const Tag = as
  return <Tag id={id} className={className}>{children}</Tag>
}

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

const MusicContent = ({ songs }: { songs: MusicTrack[] }): React.ReactElement => {
  const music: MusicTrack[] = [
    {
      id: '1',
      title: 'Street Beats',
      artist: 'J Gottem',
      cover:
        'https://res.cloudinary.com/dpytkhyme/image/upload/v1693437335/scrap_records_logo_sdwhr8.png',
      audio:
        'https://isrnomxlkzfngwebohyx.supabase.co/storage/v1/object/public/songs/J%20Gottem%20-%20Street%20Beats.mp3',
      captions: 'captions ',
      name: 'Street Beats',
      color: ['red'],
      active: true,
    },
    {
      id: '2',
      title: 'Scrapyard Anthem',
      artist: 'Ronin',
      cover:
        'https://res.cloudinary.com/dpytkhyme/image/upload/v1693437335/scrap_records_logo_sdwhr8.png',
      audio:
        'https://isrnomxlkzfngwebohyx.supabase.co/storage/v1/object/public/songs/Scrapyard%20anthem(LLJG).mp3',
      captions: 'captions ',
      name: 'Scrapyard Anthem',
      color: ['blue'],
      active: false,
    },
    {
      id: '3',
      title: 'STREETBEEFS SCRAPYARD',
      artist: 'Chase Money feat. E.D.D.I.E. & Cadderson',
      cover:
        'https://res.cloudinary.com/dpytkhyme/image/upload/v1693437335/scrap_records_logo_sdwhr8.png',
      audio:
        'https://isrnomxlkzfngwebohyx.supabase.co/storage/v1/object/public/songs/STREETBEEFS%20SCRAPYARD.mp3',
      captions: 'captions ',
      name: 'STREETBEEFS SCRAPYARD',
      color: ['green'],
      active: true,
    },
  ]
  const songList = songs.map((song) => {
    return <SongItem key={song.id} music={song} />
  })

  if (!music || music.length === 0) {
    return <Field className="pt-4 text-center text-neutral-400">No music available.</Field>
  }

  return (
    <Container className="bg-scrapBlack text-scrapWhite flex min-h-screen flex-col overflow-hidden p-10">
      <Heading id="music-library-heading" as={'h1'} className="mb-6 text-xl font-semibold">
        Music Library
      </Heading>
      <Heading id="music-library-subheading" as={'h2'} className="mb-6 text-lg font-semibold">
        {songList}
      </Heading>

      {music.map((track) => (
        <SongItem key={track.id} music={track} />
      ))}
    </Container>
  )
}

export default MusicContent
