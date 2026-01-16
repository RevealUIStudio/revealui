/**
 * Fetch events from CMS
 * Returns events from the 'events' collection
 */

import type { APIResponse } from '../../core/api/rest.js'
import { fetchFromCMS } from './client.js'

export interface EventData {
  id: number
  title: string
  name?: string
  description?: string
  image?: string
  alt?: string
}

/**
 * Fetches events from CMS
 * Maps Event collection data to EventData format
 */
export default async function fetchEvents(): Promise<EventData[]> {
  try {
    const response = await fetchFromCMS<
      APIResponse<{
        id: number
        title?: string | null
        name?: string | null
        description?: string | null
        image?:
          | {
              url?: string
              filename?: string
            }
          | number
          | null
        alt?: string | null
      }>
    >('/api/collections/events', {
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
        title: doc.title || doc.name || 'Untitled Event',
        name: doc.name || undefined,
        description: doc.description || undefined,
        image: imageUrl || undefined,
        alt: doc.alt || undefined,
      }
    })
  } catch (error) {
    console.error('Error fetching events:', error)
    return []
  }
}
