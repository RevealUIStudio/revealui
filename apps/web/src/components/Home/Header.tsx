import { logger } from '@revealui/core/utils/logger'
import type React from 'react'
import { useEffect, useMemo, useState } from 'react'
import { type Video as FetchVideo, fetchVideos } from 'revealui/client/http'
import { Container, Field, Skeleton } from 'revealui/ui/shells'
import { Paragraph } from 'revealui/ui/text'
import { VideoComponent } from 'revealui/ui/video'

type Video = {
  url: string
}

const HomeHeader: React.FC = () => {
  const initialData = useMemo(
    () => [
      {
        url: 'https://res.cloudinary.com/dpytkhyme/video/upload/v1699245369/STREETBEEFS%20SCRAPYARD/Drone_intro_r6tlny.mp4',
      },
    ],
    [],
  )
  const [videos, setVideos] = useState<Video[]>(initialData)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchVideos()
      .then((data: FetchVideo[]) => {
        if (Array.isArray(data) && data.length > 0) {
          setVideos(data)
          setIsLoading(false)
        } else {
          logger.debug('Fetched data is empty, retaining initial data')
        }
      })
      .catch((error: unknown) => {
        logger.error('Failed to fetch video sources', { error })
        const message = error instanceof Error ? error.message : 'Failed to load video sources.'
        setError(message)
        setIsLoading(false)
      })
  }, [])

  if (error) {
    return <div>Error: {error}</div>
  }

  return (
    <Container className="relative size-full overflow-hidden">
      {videos.map((video, index) => (
        <VideoComponent key={video.url || `video-${index}`} url={video.url} />
      ))}
      {isLoading && (
        <Field>
          <Paragraph>Loading videos...</Paragraph>
          <Skeleton className="mx-auto max-w-none overflow-hidden" width={600} height={600} />
        </Field>
      )}
    </Container>
  )
}

export default HomeHeader
