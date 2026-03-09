import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Drawer, DrawerBody, DrawerFooter, DrawerHeader } from '../../components/drawer.js'

describe('Drawer', () => {
  it('renders nothing when closed', () => {
    render(
      <Drawer open={false} onClose={vi.fn()}>
        <DrawerBody>Hidden</DrawerBody>
      </Drawer>,
    )
    expect(screen.queryByText('Hidden')).not.toBeInTheDocument()
  })

  it('renders content when open', () => {
    render(
      <Drawer open onClose={vi.fn()}>
        <DrawerBody>Visible</DrawerBody>
      </Drawer>,
    )
    expect(screen.getByText('Visible')).toBeInTheDocument()
  })

  it('calls onClose when backdrop is clicked', async () => {
    const onClose = vi.fn()
    render(
      <Drawer open onClose={onClose}>
        <DrawerBody>Content</DrawerBody>
      </Drawer>,
    )
    // The backdrop is the first div inside the dialog (the overlay), not the dialog itself
    const dialog = screen.getByRole('dialog')
    const backdrop = dialog.firstElementChild as HTMLElement
    backdrop.click()
    expect(onClose).toHaveBeenCalled()
  })

  it('renders DrawerHeader with title', () => {
    render(
      <Drawer open onClose={vi.fn()}>
        <DrawerHeader>My Title</DrawerHeader>
        <DrawerBody>Body</DrawerBody>
      </Drawer>,
    )
    expect(screen.getByText('My Title')).toBeInTheDocument()
  })

  it('renders DrawerFooter', () => {
    render(
      <Drawer open onClose={vi.fn()}>
        <DrawerBody>Body</DrawerBody>
        <DrawerFooter>Footer content</DrawerFooter>
      </Drawer>,
    )
    expect(screen.getByText('Footer content')).toBeInTheDocument()
  })
})
