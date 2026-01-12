/**
 * Frontend application type definitions
 * These types are used by the frontend web app
 */

export interface MainInfo {
  id: number
  title: string
  subtitle: string
  description: string
  image: string
}

export interface ContentSectionProps {
  info: MainInfo
  index: number
}

export interface Video {
  url: string
}

export interface CardData {
  name: string
  image: string
  label: string
  cta: string
  href: string
  loading?: 'eager' | 'lazy'
}

export interface HeroProps {
  id: number
  image: string
  videos: string
  altText: string
  href: string
}

export interface EventData {
  id: number
  title: string
  name?: string
  description?: string
  image?: string
  alt?: string
}

export interface BannerProps {
  id: number
  title?: string
  description?: string
  image?: string
  link?: string
  alt?: string
}
