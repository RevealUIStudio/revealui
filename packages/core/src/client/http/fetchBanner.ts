/**
 * Fetch banners from CMS
 * Returns banners from the 'banners' collection
 */

import { logger } from '@revealui/core/utils/logger'
import type { APIResponse } from '../../core/api/rest.js'
import { fetchFromCMS } from './client.js'

export interface BannerData {
  id: number
  title?: string
  description?: string
  image?: string
  link?: string
  alt?: string
}

/**
 * Fetches banners from CMS
 * Maps Banner collection data to BannerData format
 */
export default async function fetchBanner(): Promise<BannerData[]> {
  try {
    const response = await fetchFromCMS<
      APIResponse<{
        id: number
        title?: string | null
        description?: string | null
        image?:
          | {
              url?: string
              filename?: string
            }
          | number
          | null
        link?: string | null
        alt?: string | null
      }>
    >('/api/collections/banners', {
      params: {
        depth: 1,
        limit: 10,
      },
    })

    return (response.docs || []).map((doc) => {
      // Extract image URL
      let imageUrl = ''
      if (doc.image) {
        if (typeof doc.image === 'object' && 'url' in doc.image) {
          imageUrl = doc.image.url || ''
        } else if (typeof doc.image === 'string') {
          imageUrl = doc.image
        }
      }

      return {
        id: doc.id,
        title: doc.title || undefined,
        description: doc.description || undefined,
        image: imageUrl || undefined,
        link: doc.link || undefined,
        alt: doc.alt || undefined,
      }
    })
  } catch (error) {
    logger.error('Error fetching banners', { error })
    return []
  }
}
