/**
 * Fetch main info content from CMS
 * Returns content from the 'contents' collection
 */

import { logger } from '@revealui/core/utils/logger'
import type { APIResponse } from '../../core/api/rest.js'
import { fetchFromCMS } from './client.js'

export interface MainInfo {
  id: number
  title: string
  subtitle: string
  description: string
  image: string
}

/**
 * Fetches main info content from CMS
 * Maps Content collection data to MainInfo format
 */
export default async function fetchMainInfos(): Promise<MainInfo[]> {
  try {
    const response = await fetchFromCMS<
      APIResponse<{
        id: number
        name: string
        description?: string | null
        image?: {
          url?: string
          filename?: string
        } | null
      }>
    >('/api/collections/contents', {
      params: {
        depth: 1,
        limit: 10,
      },
    })

    // Transform CMS Content to MainInfo format
    return (response.docs || []).map((doc) => {
      // Extract image URL - handle different possible structures
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
        title: doc.name || 'Untitled',
        subtitle: doc.description?.split('.')[0] || '',
        description: doc.description || '',
        image: imageUrl,
      }
    })
  } catch (error) {
    logger.error('Error fetching main infos', { error })
    return []
  }
}
