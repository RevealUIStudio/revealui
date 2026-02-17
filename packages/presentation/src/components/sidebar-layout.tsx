'use client'

import type React from 'react'
import { useCallback, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CloseContext } from '../hooks/use-close-context.js'
import { useEscapeKey } from '../hooks/use-escape-key.js'
import { useFocusTrap } from '../hooks/use-focus-trap.js'
import { useScrollLock } from '../hooks/use-scroll-lock.js'
import { useTransition } from '../hooks/use-transition.js'
import { NavbarItem } from './navbar.js'

function OpenMenuIcon() {
  return (
    <svg data-slot="icon" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M2 6.75C2 6.33579 2.33579 6 2.75 6H17.25C17.6642 6 18 6.33579 18 6.75C18 7.16421 17.6642 7.5 17.25 7.5H2.75C2.33579 7.5 2 7.16421 2 6.75ZM2 13.25C2 12.8358 2.33579 12.5 2.75 12.5H17.25C17.6642 12.5 18 12.8358 18 13.25C18 13.6642 17.6642 14 17.25 14H2.75C2.33579 14 2 13.6642 2 13.25Z" />
    </svg>
  )
}

function CloseMenuIcon() {
  return (
    <svg data-slot="icon" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
    </svg>
  )
}

function MobileSidebar({
  open,
  close,
  children,
}: React.PropsWithChildren<{ open: boolean; close: () => void }>) {
  const panelRef = useRef<HTMLDivElement>(null)

  const backdrop = useTransition(open)
  const panel = useTransition(open)

  useScrollLock(open)
  useFocusTrap(panelRef, open)
  useEscapeKey(close, open)

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        close()
      }
    },
    [close],
  )

  if (!(backdrop.mounted || panel.mounted)) return null

  return createPortal(
    <CloseContext.Provider value={close}>
      <div role="dialog" aria-modal="true" className="lg:hidden">
        {/* Backdrop */}
        {backdrop.mounted && (
          <div
            ref={backdrop.nodeRef as React.RefObject<HTMLDivElement>}
            {...backdrop.transitionProps}
            onClick={handleBackdropClick}
            className="fixed inset-0 bg-black/30 transition data-closed:opacity-0 data-enter:duration-300 data-enter:ease-out data-leave:duration-200 data-leave:ease-in"
          />
        )}

        {/* Panel */}
        {panel.mounted && (
          <div
            ref={(node) => {
              ;(panelRef as React.MutableRefObject<HTMLDivElement | null>).current = node
              ;(panel.nodeRef as React.MutableRefObject<HTMLElement | null>).current = node
            }}
            {...panel.transitionProps}
            className="fixed inset-y-0 w-full max-w-80 p-2 transition duration-300 ease-in-out data-closed:-translate-x-full"
          >
            <div className="flex h-full flex-col rounded-lg bg-white shadow-xs ring-1 ring-zinc-950/5 dark:bg-zinc-900 dark:ring-white/10">
              <div className="-mb-3 px-4 pt-3">
                <NavbarItem onClick={close} aria-label="Close navigation">
                  <CloseMenuIcon />
                </NavbarItem>
              </div>
              {children}
            </div>
          </div>
        )}
      </div>
    </CloseContext.Provider>,
    document.body,
  )
}

export function SidebarLayout({
  navbar,
  sidebar,
  children,
}: React.PropsWithChildren<{
  navbar: React.ReactNode
  sidebar: React.ReactNode
}>) {
  const [showSidebar, setShowSidebar] = useState(false)

  return (
    <div className="relative isolate flex min-h-svh w-full bg-white max-lg:flex-col lg:bg-zinc-100 dark:bg-zinc-900 dark:lg:bg-zinc-950">
      {/* Sidebar on desktop */}
      <div className="fixed inset-y-0 left-0 w-64 max-lg:hidden">{sidebar}</div>

      {/* Sidebar on mobile */}
      <MobileSidebar open={showSidebar} close={() => setShowSidebar(false)}>
        {sidebar}
      </MobileSidebar>

      {/* Navbar on mobile */}
      <header className="flex items-center px-4 lg:hidden">
        <div className="py-2.5">
          <NavbarItem onClick={() => setShowSidebar(true)} aria-label="Open navigation">
            <OpenMenuIcon />
          </NavbarItem>
        </div>
        <div className="min-w-0 flex-1">{navbar}</div>
      </header>

      {/* Content */}
      <main className="flex flex-1 flex-col pb-2 lg:min-w-0 lg:pt-2 lg:pr-2 lg:pl-64">
        <div className="grow p-6 lg:rounded-lg lg:bg-white lg:p-10 lg:shadow-xs lg:ring-1 lg:ring-zinc-950/5 dark:lg:bg-zinc-900 dark:lg:ring-white/10">
          <div className="mx-auto max-w-6xl">{children}</div>
        </div>
      </main>
    </div>
  )
}
