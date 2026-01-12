/**
 * Fetch cards from CMS
 * Returns cards from the 'cards' collection
 */

import type { APIResponse } from '../../core/api/rest'
import { fetchFromCMS } from './client'

export interface CardData {
  name: string
  image: string
  label: string
  cta: string
  href: string
  loading?: 'eager' | 'lazy'
}

/**
 * Fetches cards from CMS
 * Maps Card collection data to CardData format
 */
export default async function fetchCard(): Promise<CardData[]> {
  try {
    const response = await fetchFromCMS<
      APIResponse<{
        id: number
        name?: string | null
        image?:
          | {
              url?: string
              filename?: string
            }
          | number
          | null
        label?: string | null
        cta?: string | null
        href?: string | null
        loading?: ('eager' | 'lazy') | null
      }>
    >('/api/collections/cards', {
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

        return {
          name: doc.name || '',
          image: imageUrl,
          label: doc.label || '',
          cta: doc.cta || '',
          href: doc.href || '/',
          loading: doc.loading || 'eager',
        }
      })
      .filter((card) => card.name && card.image) // Filter out incomplete cards
  } catch (error) {
    console.error('Error fetching cards:', error)
    return []
  }
}
