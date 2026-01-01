import React from 'react'

interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string
  children: React.ReactNode
}

export function Link({ href, children, ...props }: LinkProps) {
  return (
    <a href={href} {...props}>
      {children}
    </a>
  )
}

export function navigate(href: string) {
  window.history.pushState({}, '', href)
  // In a real implementation, this would trigger a route change
  window.dispatchEvent(new PopStateEvent('popstate'))
}
