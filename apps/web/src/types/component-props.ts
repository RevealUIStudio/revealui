/**
 * Shared TypeScript interfaces for React component props
 *
 * This file provides common prop type definitions used across multiple
 * components in the web application. Import these instead of duplicating
 * interface definitions.
 *
 * @example
 * ```typescript
 * import type { ContainerProps, HeadingProps } from '@/types/component-props'
 *
 * const MyComponent = ({ children, className }: ContainerProps) => (
 *   <div className={className}>{children}</div>
 * )
 * ```
 */

import React from 'react'

// ============================================================================
// Basic Layout Components
// ============================================================================

export interface ContainerProps {
  children: React.ReactNode
  className?: string
  as?: React.ElementType
  id?: string
}

export interface FieldProps {
  children: React.ReactNode
  className?: string
  id?: string
}

export interface FlexContainerProps {
  children: React.ReactNode
  className?: string
  id?: string
}

export interface GridContainerProps {
  children: React.ReactNode
  className?: string
  id?: string
  [key: string]: unknown
}

// ============================================================================
// Typography Components
// ============================================================================

export interface HeadingProps {
  children: React.ReactNode
  id?: string
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
  className?: string
}

export interface ParagraphProps {
  children: React.ReactNode
  className?: string
  id?: string
}

export interface TextProps {
  children: React.ReactNode
  className?: string
}

// ============================================================================
// Interactive Components
// ============================================================================

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode
  className?: string
  onClick?: (event?: React.MouseEvent<HTMLButtonElement>) => void
}

export interface LinkProps {
  children: React.ReactNode
  href: string
  className?: string
  target?: string
  rel?: string
}

// ============================================================================
// Media Components
// ============================================================================

export interface ImageProps {
  src: string
  alt: string
  className?: string
  width?: number
  height?: number
}

export interface VideoComponentProps {
  src: string
  className?: string
  autoPlay?: boolean
  loop?: boolean
  muted?: boolean
}

export interface GridImage {
  id: string | number
  image: string
  alt: string
}

export interface ImageGridProps {
  images: GridImage[]
  className?: string
}

// ============================================================================
// SVG Components
// ============================================================================

export interface SVGProps {
  children?: React.ReactNode
  className?: string
  viewBox?: string
  fill?: string
  xmlns?: string
  width?: string | number
  height?: string | number
  [key: string]: unknown
}

export interface PathProps {
  d?: string
  fill?: string
  stroke?: string
  strokeWidth?: string | number
  className?: string
  [key: string]: unknown
}

export interface CircleProps {
  cx?: string | number
  cy?: string | number
  r?: string | number
  fill?: string
  stroke?: string
  strokeWidth?: string | number
  className?: string
  [key: string]: unknown
}

export interface RectProps {
  x?: string | number
  y?: string | number
  width?: string | number
  height?: string | number
  fill?: string
  stroke?: string
  className?: string
  [key: string]: unknown
}

export interface PatternProps {
  id?: string
  x?: string | number
  y?: string | number
  width?: string | number
  height?: string | number
  patternUnits?: string
  children?: React.ReactNode
}

export interface StopProps {
  offset?: string
  stopColor?: string
  stopOpacity?: string | number
}

// ============================================================================
// List Components
// ============================================================================

export interface ListProps {
  children: React.ReactNode
  className?: string
  id?: string
}

export interface UListProps {
  children: React.ReactNode
  className?: string
}

export interface DescriptionListItem {
  name: string
  value: string
}

export interface DescriptionListProps {
  items: DescriptionListItem[]
  className?: string
}

// ============================================================================
// Background/Layout Wrapper Components
// ============================================================================

export interface BackgroundWrapperProps {
  children: React.ReactNode
  className?: string
}

export interface ParallaxComponentProps {
  children: React.ReactNode
  className?: string
}

export interface SolidProps {
  children: React.ReactNode
  className?: string
}

export interface GradientGlassProps {
  children: React.ReactNode
  className?: string
}

export interface GradientToBottomProps {
  children: React.ReactNode
  className?: string
}

// ============================================================================
// Data Display Components
// ============================================================================

export interface CardProps {
  children?: React.ReactNode
  className?: string
  title?: string
  description?: string
}

export interface SkeletonProps {
  className?: string
  width?: string | number
  height?: string | number
}

export interface TimeItem {
  dateTime?: string
  date?: string
}

export interface TimeProps {
  children?: React.ReactNode
  item?: TimeItem
  className?: string
}

// ============================================================================
// Music/Media Specific
// ============================================================================

export interface MusicTrack {
  id: string
  name: string
  title: string
  artist: string
  cover: string
  audio: string
  captions: string
  color: string[]
  active: boolean
}

export interface SongItemProps {
  music: MusicTrack
}

// ============================================================================
// Carousel/Slider Components
// ============================================================================

export interface Slide {
  id: string | number
  image: string
  alt?: string
  title?: string
  description?: string
}

export interface SliderProps {
  slides: Slide[]
  className?: string
}

// ============================================================================
// Utility Types
// ============================================================================

export type ClassValue = string | number | boolean | undefined | null

/**
 * Utility function type for combining class names
 */
export type ClassNameCombiner = (...inputs: ClassValue[]) => string
