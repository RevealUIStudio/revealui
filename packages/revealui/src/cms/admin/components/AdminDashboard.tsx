'use client'

import React, { useState, useEffect } from 'react'
import type { RevealConfig, RevealDocument, RevealCollectionConfig } from '../../types/index.js'
import { CollectionList } from './CollectionList'
import { DocumentForm } from './DocumentForm'

interface AdminDashboardProps {
  config: RevealConfig
}

type ViewType = 'dashboard' | 'collection' | 'edit'

interface CurrentView {
  type: ViewType
  collection?: RevealCollectionConfig
  document?: RevealDocument
}

export function AdminDashboard({ config }: AdminDashboardProps) {
  const [currentView, setCurrentView] = useState<CurrentView>({ type: 'dashboard' })
  const [collectionData, setCollectionData] = useState<{
    documents: RevealDocument[]
    totalDocs: number
    page: number
    totalPages: number
  }>({ documents: [], totalDocs: 0, page: 1, totalPages: 1 })

  const collections = config.collections || []
  const globals = config.globals || []

  const handleCollectionClick = async (collection: RevealCollectionConfig) => {
    // TODO: Fetch collection data from API
    setCurrentView({ type: 'collection', collection })
    // Mock data for now
    setCollectionData({
      documents: [],
      totalDocs: 0,
      page: 1,
      totalPages: 1,
    })
  }

  const handleCreate = () => {
    if (currentView.collection) {
      setCurrentView({ type: 'edit', collection: currentView.collection })
    }
  }

  const handleEdit = (document: RevealDocument) => {
    if (currentView.collection) {
      setCurrentView({ type: 'edit', collection: currentView.collection, document })
    }
  }

  const handleDelete = (document: RevealDocument) => {
    // TODO: Implement delete functionality
    console.log('Delete document:', document)
  }

  const handleSave = (data: Record<string, any>) => {
    // TODO: Implement save functionality
    console.log('Save document:', data)
    setCurrentView({ type: 'dashboard' })
  }

  const handleCancel = () => {
    setCurrentView({ type: 'dashboard' })
  }

  const handlePageChange = (page: number) => {
    setCollectionData((prev) => ({ ...prev, page }))
    // TODO: Fetch new page data
  }

  if (currentView.type === 'collection' && currentView.collection) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setCurrentView({ type: 'dashboard' })}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ← Back to Dashboard
                </button>
                <h1 className="text-2xl font-bold text-gray-900 capitalize">
                  {String(currentView.collection.slug)}
                </h1>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <CollectionList
            collection={currentView.collection}
            documents={collectionData.documents}
            totalDocs={collectionData.totalDocs}
            page={collectionData.page}
            totalPages={collectionData.totalPages}
            onCreate={handleCreate}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onPageChange={handlePageChange}
          />
        </main>
      </div>
    )
  }

  if (currentView.type === 'edit' && currentView.collection) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setCurrentView({ type: 'dashboard' })}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ← Back to Dashboard
                </button>
                <h1 className="text-2xl font-bold text-gray-900 capitalize">
                  {currentView.document ? 'Edit' : 'Create'}{' '}
                  {String(currentView.collection.slug).slice(0, -1)}
                </h1>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <DocumentForm
              collection={currentView.collection}
              document={currentView.document}
              onSave={handleSave}
              onCancel={handleCancel}
            />
          </div>
        </main>
      </div>
    )
  }

  // Dashboard view
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">RevealUI Admin</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">v0.1.0</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {/* Collections */}
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg
                      className="h-8 w-8 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                      />
                    </svg>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Collections</dt>
                      <dd className="text-lg font-medium text-gray-900">{collections.length}</dd>
                    </dl>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-5 py-3">
                <div className="text-sm">
                  {collections.length > 0 ? (
                    <ul className="space-y-1">
                      {collections.slice(0, 3).map((collection) => (
                        <li
                          key={String(collection.slug)}
                          className="text-gray-600 hover:text-gray-900"
                        >
                          <button
                            onClick={() => handleCollectionClick(collection)}
                            className="hover:underline cursor-pointer"
                          >
                            {String(collection.slug)}
                          </button>
                        </li>
                      ))}
                      {collections.length > 3 && (
                        <li className="text-gray-400">+{collections.length - 3} more</li>
                      )}
                    </ul>
                  ) : (
                    <p className="text-gray-500">No collections configured</p>
                  )}
                </div>
              </div>
            </div>

            {/* Globals */}
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg
                      className="h-8 w-8 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4"
                      />
                    </svg>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Globals</dt>
                      <dd className="text-lg font-medium text-gray-900">{globals.length}</dd>
                    </dl>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-5 py-3">
                <div className="text-sm">
                  {globals.length > 0 ? (
                    <ul className="space-y-1">
                      {globals.slice(0, 3).map((global) => (
                        <li key={String(global.slug)} className="text-gray-600">
                          {String(global.slug)}
                        </li>
                      ))}
                      {globals.length > 3 && (
                        <li className="text-gray-400">+{globals.length - 3} more</li>
                      )}
                    </ul>
                  ) : (
                    <p className="text-gray-500">No globals configured</p>
                  )}
                </div>
              </div>
            </div>

            {/* System Status */}
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
                      <svg
                        className="h-5 w-5 text-green-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">System Status</dt>
                      <dd className="text-lg font-medium text-gray-900">Healthy</dd>
                    </dl>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-5 py-3">
                <div className="text-sm text-gray-600">RevealUI CMS is running successfully</div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
