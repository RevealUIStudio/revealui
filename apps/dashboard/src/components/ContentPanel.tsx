'use client'

import { useState } from 'react'

type ViewMode = 'preview' | 'editor'

export function ContentPanel() {
  const [viewMode, setViewMode] = useState<ViewMode>('preview')
  const [selectedContent, setSelectedContent] = useState('home')

  return (
    <div className="h-full bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-white">Content Panel</h2>

          {/* Content Selector */}
          <select
            value={selectedContent}
            onChange={(e) => setSelectedContent(e.target.value)}
            className="bg-gray-800 border border-gray-600 rounded-md px-3 py-1 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="home">Homepage</option>
            <option value="about">About Page</option>
            <option value="blog">Blog</option>
            <option value="contact">Contact</option>
          </select>
        </div>

        {/* View Mode Toggle */}
        <div className="flex bg-gray-800 rounded-md p-1">
          <button
            onClick={() => setViewMode('preview')}
            type="button"
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              viewMode === 'preview' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            Preview
          </button>
          <button
            onClick={() => setViewMode('editor')}
            type="button"
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              viewMode === 'editor' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            Editor
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        {viewMode === 'preview' ? (
          <div className="h-full bg-white">
            {/* Live Preview Iframe Placeholder */}
            <div className="h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg
                    className="w-8 h-8 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <title>Live preview</title>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Live Website Preview</h3>
                <p className="text-gray-600 mb-4">
                  {selectedContent === 'home' && 'Homepage content will appear here'}
                  {selectedContent === 'about' && 'About page content will appear here'}
                  {selectedContent === 'blog' && 'Blog content will appear here'}
                  {selectedContent === 'contact' && 'Contact page content will appear here'}
                </p>
                <button
                  type="button"
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                >
                  Publish Changes
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full bg-gray-800 p-6">
            {/* Content Editor Placeholder */}
            <div className="bg-gray-700 rounded-lg p-6 h-full">
              <h3 className="text-white text-lg font-medium mb-4">Content Editor</h3>
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="content-page-title"
                    className="block text-sm font-medium text-gray-300 mb-2"
                  >
                    Page Title
                  </label>
                  <input
                    id="content-page-title"
                    type="text"
                    defaultValue={
                      selectedContent === 'home'
                        ? 'Welcome to Our Agency'
                        : selectedContent === 'about'
                          ? 'About Our Agency'
                          : selectedContent === 'blog'
                            ? 'Latest Blog Posts'
                            : 'Contact Us'
                    }
                    className="w-full bg-gray-600 border border-gray-500 rounded-md px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="content-body"
                    className="block text-sm font-medium text-gray-300 mb-2"
                  >
                    Content
                  </label>
                  <textarea
                    id="content-body"
                    rows={8}
                    defaultValue={
                      selectedContent === 'home'
                        ? 'This is the homepage content. Use the AI agent to help optimize this copy.'
                        : selectedContent === 'about'
                          ? 'Learn about our agency and our mission.'
                          : selectedContent === 'blog'
                            ? 'Read our latest thoughts and insights.'
                            : 'Get in touch with our team.'
                    }
                    className="w-full bg-gray-600 border border-gray-500 rounded-md px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Ask AI to Improve
                  </button>
                  <button
                    type="button"
                    className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors"
                  >
                    Save Draft
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
