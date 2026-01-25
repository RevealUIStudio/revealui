'use client'

/**
 * RevealUI Rich Text Editor - Image Upload Button
 *
 * Component for uploading images and inserting them into the editor.
 */

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { logger } from '@revealui/core/utils/logger'
import type React from 'react'
import { useCallback, useRef, useState } from 'react'
import { INSERT_IMAGE_COMMAND } from '../nodes/ImageNode.js'

interface ImageUploadButtonProps {
  onUploadStart?: () => void
  onUploadComplete?: (url: string) => void
  onUploadError?: (error: Error) => void
  uploadEndpoint?: string
  acceptedFileTypes?: string
}

type UploadResponse = {
  url?: unknown
  src?: unknown
  data?: { url?: unknown } | null
}

const getUploadUrl = (payload: unknown): string | null => {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const result = payload as UploadResponse
  if (typeof result.url === 'string') return result.url
  if (typeof result.src === 'string') return result.src
  if (result.data && typeof result.data.url === 'string') return result.data.url

  return null
}

export const ImageUploadButton: React.FC<ImageUploadButtonProps> = ({
  onUploadStart,
  onUploadComplete,
  onUploadError,
  uploadEndpoint = '/api/media',
  acceptedFileTypes = 'image/jpeg,image/jpg,image/png,image/webp,image/gif',
}) => {
  const [editor] = useLexicalComposerContext()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)

  const handleFileSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return

      // Validate file type
      if (!file.type.startsWith('image/')) {
        onUploadError?.(new Error('File must be an image'))
        return
      }

      // Validate file size (default 10MB limit)
      const maxSize = 10 * 1024 * 1024 // 10MB
      if (file.size > maxSize) {
        onUploadError?.(new Error('Image size must be less than 10MB'))
        return
      }

      setIsUploading(true)
      onUploadStart?.()

      try {
        // Read image dimensions
        const imageDimensions = await new Promise<{
          width: number
          height: number
        }>((resolve, reject) => {
          const img = new Image()
          img.onload = () => {
            resolve({ width: img.width, height: img.height })
          }
          img.onerror = reject
          img.src = URL.createObjectURL(file)
        })

        // Upload file
        const formData = new FormData()
        formData.append('file', file)

        const response = await fetch(uploadEndpoint, {
          method: 'POST',
          body: formData,
          headers: {
            // Don't set Content-Type - browser will set it with boundary for FormData
          },
        })

        if (!response.ok) {
          throw new Error(`Upload failed: ${response.statusText}`)
        }

        const result = (await response.json()) as unknown

        // Extract URL from response (adapt based on your API response structure)
        const imageUrl = getUploadUrl(result)
        if (!imageUrl) {
          throw new Error('No URL returned from upload')
        }

        // Insert image into editor
        editor.dispatchCommand(INSERT_IMAGE_COMMAND, {
          src: imageUrl,
          alt: file.name.replace(/\.[^/.]+$/, ''), // Remove extension for alt text
          width: imageDimensions.width,
          height: imageDimensions.height,
        })

        onUploadComplete?.(imageUrl)
      } catch (error) {
        logger.error('Image upload error', { error })
        onUploadError?.(error instanceof Error ? error : new Error('Upload failed'))
      } finally {
        setIsUploading(false)
        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      }
    },
    [editor, uploadEndpoint, onUploadStart, onUploadComplete, onUploadError],
  )

  const triggerFileSelect = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptedFileTypes}
        onChange={(event) => void handleFileSelect(event)}
        style={{ display: 'none' }}
        aria-label="Upload image"
      />
      <button
        type="button"
        onClick={triggerFileSelect}
        disabled={isUploading}
        className="toolbar-btn"
        title={isUploading ? 'Uploading...' : 'Insert Image'}
        aria-label="Insert Image"
        style={{
          opacity: isUploading ? 0.6 : 1,
          cursor: isUploading ? 'wait' : 'pointer',
        }}
      >
        {isUploading ? '⏳' : '🖼️'}
      </button>
    </>
  )
}
