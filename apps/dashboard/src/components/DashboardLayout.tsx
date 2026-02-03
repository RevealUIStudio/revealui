/**
 * DashboardLayout Component
 *
 * Main layout wrapper for dashboard pages
 */

import React from 'react'

export interface DashboardLayoutProps {
  children?: React.ReactNode
  showSidebar?: boolean
  className?: string
}

export const DashboardLayout = React.forwardRef<HTMLDivElement, DashboardLayoutProps>(
  ({ children, showSidebar = true, className = '' }, ref) => {
    return (
      <div ref={ref} className={`min-h-screen bg-gray-50 dark:bg-gray-900 ${className}`}>
        {/* Header */}
        <header className="bg-white dark:bg-gray-800 shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          </div>
        </header>

        <div className="flex">
          {/* Sidebar */}
          {showSidebar && (
            <aside className="w-64 bg-white dark:bg-gray-800 shadow-lg min-h-[calc(100vh-5rem)]">
              <nav aria-label="Main navigation" className="p-4">
                <ul className="space-y-2">
                  <li>
                    <a
                      href="/dashboard"
                      className="block px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                    >
                      Overview
                    </a>
                  </li>
                  <li>
                    <a
                      href="/dashboard/analytics"
                      className="block px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                    >
                      Analytics
                    </a>
                  </li>
                  <li>
                    <a
                      href="/dashboard/settings"
                      className="block px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                    >
                      Settings
                    </a>
                  </li>
                </ul>
              </nav>
            </aside>
          )}

          {/* Main Content */}
          <main className="flex-1 p-8">{children}</main>
        </div>
      </div>
    )
  },
)

DashboardLayout.displayName = 'DashboardLayout'
