'use client'

/**
 * RevealUI Rich Text Editor - Image Node Component
 *
 * React component for rendering and editing images in the editor.
 */

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $getNodeByKey } from 'lexical'
import type React from 'react'
import { useCallback, useState } from 'react'
import type { ImageNodeData } from '../nodes/ImageNode.js'
import { OPEN_IMAGE_UPLOAD_COMMAND } from '../nodes/ImageNode.js'

type Props = {
  data: ImageNodeData
  nodeKey: string
}

export const ImageNodeComponent: React.FC<Props> = (props) => {
  const { data, nodeKey } = props
  const [editor] = useLexicalComposerContext()
  const [isEditing, setIsEditing] = useState(false)
  const [editAlt, setEditAlt] = useState(data.alt || '')

  const removeImage = useCallback(() => {
    editor.update(() => {
      const foundNode = $getNodeByKey(nodeKey)
      if (foundNode) {
        foundNode.remove()
      }
    })
  }, [editor, nodeKey])

  const updateAlt = useCallback(() => {
    if (editAlt !== data.alt) {
      editor.update(() => {
        const foundNode = $getNodeByKey(nodeKey)
        if (foundNode && 'setData' in foundNode) {
          ;(foundNode as { setData: (nextData: ImageNodeData) => void }).setData({
            ...data,
            alt: editAlt,
          })
        }
      })
    }
    setIsEditing(false)
  }, [editor, nodeKey, editAlt, data])

  const handleEdit = useCallback(() => {
    editor.dispatchCommand(OPEN_IMAGE_UPLOAD_COMMAND, {
      data,
      nodeKey,
    })
  }, [editor, data, nodeKey])

  const [showControls, setShowControls] = useState(false)

  return (
    <figure className="editor-image-container" style={{ margin: '16px 0', textAlign: 'center' }}>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: hover-only wrapper for image controls. */}
      <div
        className="editor-image-wrapper"
        style={{ position: 'relative', display: 'inline-block' }}
        onMouseEnter={() => setShowControls(true)}
        onMouseLeave={() => setShowControls(false)}
      >
        <img
          src={data.src}
          alt={data.alt || ''}
          width={data.width}
          height={data.height}
          style={{
            maxWidth: '100%',
            height: 'auto',
            display: 'block',
          }}
          onError={(e) => {
            // Show placeholder on error
            const target = e.target as HTMLImageElement
            target.src =
              'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%23e2e8f0" width="400" height="300"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%2394a3b8" font-family="sans-serif"%3EImage not found%3C/text%3E%3C/svg%3E'
          }}
        />
        <div
          className="editor-image-controls"
          style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            display: 'flex',
            gap: '4px',
            opacity: showControls ? 1 : 0,
            transition: 'opacity 0.2s',
            pointerEvents: showControls ? 'auto' : 'none',
          }}
        >
          <button
            type="button"
            onClick={handleEdit}
            className="editor-image-btn"
            style={{
              padding: '4px 8px',
              background: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
            }}
            title="Edit Image"
            aria-label="Edit Image"
          >
            ✎
          </button>
          <button
            type="button"
            onClick={removeImage}
            className="editor-image-btn"
            style={{
              padding: '4px 8px',
              background: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
            }}
            title="Remove Image"
            aria-label="Remove Image"
          >
            ×
          </button>
        </div>
      </div>
      {isEditing ? (
        <input
          type="text"
          value={editAlt}
          onChange={(e) => setEditAlt(e.target.value)}
          onBlur={updateAlt}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              updateAlt()
            } else if (e.key === 'Escape') {
              setEditAlt(data.alt || '')
              setIsEditing(false)
            }
          }}
          placeholder="Image alt text"
          style={{
            width: '100%',
            marginTop: '8px',
            padding: '4px 8px',
            border: '1px solid #e2e8f0',
            borderRadius: '4px',
          }}
        />
      ) : (
        data.caption && (
          <figcaption
            style={{
              marginTop: '8px',
              fontSize: '14px',
              color: '#64748b',
              fontStyle: 'italic',
            }}
          >
            {data.caption}
          </figcaption>
        )
      )}
    </figure>
  )
}
