/**
 * Fetch videos from CMS
 * Returns videos from the 'videos' collection
 */

import type { APIResponse } from '../../core/api/rest.js'
import { fetchFromCMS } from './client.js'

export interface Video {
  url: string
}

/**
 * Fetches videos from CMS
 * Returns array of video URLs
 */
export default async function fetchVideos(): Promise<Video[]> {
  try {
    const response = await fetchFromCMS<
      APIResponse<{
        id: number
        url?: string | null
        file?: {
          url?: string
          filename?: string
        } | null
      }>
    >('/api/collections/videos', {
      params: {
        depth: 1,
        limit: 10,
      },
    })

    return (response.docs || [])
      .map((doc) => {
        // Extract video URL from different possible structures
        if (doc.url) {
          return { url: doc.url }
        }
        if (doc.file?.url) {
          return { url: doc.file.url }
        }
        return null
      })
      .filter((video): video is Video => video !== null)
  } catch (error) {
    console.error('Error fetching videos:', error)
    return []
  }
}
