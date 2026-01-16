/**
 * Fetch hero content from CMS
 * Returns heroes from the 'heros' collection
 */

import type { APIResponse } from '../../core/api/rest.js'
import { fetchFromCMS } from './client.js'

export interface HeroData {
  id: number
  image: string
  videos: string
  altText: string
  href: string
}

/**
 * Fetches hero content from CMS
 * Maps Hero collection data to HeroData format
 */
export default async function fetchHero(): Promise<HeroData[]> {
  try {
    const response = await fetchFromCMS<
      APIResponse<{
        id: number
        href?: string | null
        altText?: string | null
        image?:
          | {
              url?: string
              filename?: string
            }
          | number
          | null
        video?:
          | {
              url?: string
              filename?: string
            }
          | string
          | null
      }>
    >('/api/collections/heros', {
      params: {
        depth: 1,
        limit: 10,
      },
    })

    return (response.docs || [])
      .map((doc) => {
        // Extract image URL
        let imageUrl = ''
        if (doc.image) {
          if (typeof doc.image === 'object' && 'url' in doc.image) {
            imageUrl = doc.image.url || ''
          } else if (typeof doc.image === 'string') {
            imageUrl = doc.image
          }
        }

        // Extract video URL
        let videoUrl = ''
        if (doc.video) {
          if (typeof doc.video === 'object' && 'url' in doc.video) {
            videoUrl = doc.video.url || ''
          } else if (typeof doc.video === 'string') {
            videoUrl = doc.video
          }
        }

        return {
          id: doc.id,
          image: imageUrl,
          videos: videoUrl,
          altText: doc.altText || '',
          href: doc.href || '/',
        }
      })
      .filter((hero) => hero.image || hero.videos) // Filter out incomplete heroes
  } catch (error) {
    console.error('Error fetching heroes:', error)
    return []
  }
}
