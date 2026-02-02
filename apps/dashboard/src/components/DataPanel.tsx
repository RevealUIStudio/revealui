/**
 * DataPanel Component
 *
 * Displays a metric panel with value, trend, and status indicators
 */

import React from 'react'

export interface DataPanelProps {
  title: string
  value: number | string
  unit?: string
  trend?: number
  status?: 'healthy' | 'warning' | 'critical'
  loading?: boolean
  error?: string
  onClick?: () => void
  className?: string
  style?: React.CSSProperties
  'aria-label'?: string
}

export const DataPanel = React.forwardRef<HTMLDivElement, DataPanelProps>(
  (
    {
      title,
      value,
      unit,
      trend,
      status = 'healthy',
      loading,
      error,
      onClick,
      className = '',
      style,
      'aria-label': ariaLabel,
    },
    ref,
  ) => {
    const formatValue = (val: number | string): string => {
      if (typeof val === 'string') return val

      // Handle special numeric values
      if (!Number.isFinite(val)) {
        if (val === Number.POSITIVE_INFINITY || val === Number.NEGATIVE_INFINITY) {
          return 'Infinity'
        }
        if (Number.isNaN(val)) {
          return 'Invalid'
        }
      }

      // Format large numbers with commas
      return val.toLocaleString('en-US', {
        maximumFractionDigits: 2,
      })
    }

    const getStatusColor = () => {
      switch (status) {
        case 'healthy':
          return 'bg-green-500'
        case 'warning':
          return 'bg-yellow-500'
        case 'critical':
          return 'bg-red-500'
        default:
          return 'bg-gray-500'
      }
    }

    const getTrendAriaLabel = (): string => {
      if (trend === undefined) return ''
      if (trend > 0) return `trending up by ${trend.toFixed(1)} percent`
      if (trend < 0) return `trending down by ${Math.abs(trend).toFixed(1)} percent`
      return 'no change'
    }

    if (loading) {
      return (
        <div
          ref={ref}
          className={`bg-white dark:bg-gray-800 rounded-lg shadow p-6 ${className}`}
          style={style}
          aria-label={ariaLabel || `${title} panel`}
          data-status={status}
          role="status"
          aria-busy="true"
        >
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-4"></div>
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
          </div>
        </div>
      )
    }

    if (error) {
      return (
        <div
          ref={ref}
          className={`bg-white dark:bg-gray-800 rounded-lg shadow p-6 ${className}`}
          style={style}
          aria-label={ariaLabel || `${title} panel`}
          data-status={status}
        >
          <div className="text-red-500">
            <svg
              className="w-6 h-6 mb-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              role="img"
              aria-label="Error icon"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="font-medium">{error}</p>
          </div>
        </div>
      )
    }

    return (
      <div
        ref={ref}
        className={`bg-white dark:bg-gray-800 rounded-lg shadow p-6 transition-all ${
          onClick ? 'cursor-pointer hover:shadow-lg hover:scale-105' : ''
        } ${className}`}
        style={style}
        onClick={onClick}
        onKeyDown={(e) => {
          if (onClick && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault()
            onClick()
          }
        }}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        aria-label={ariaLabel || `${title} panel`}
        data-status={status}
      >
        <div
          className={`flex items-start justify-between mb-3 ${onClick ? 'cursor-pointer' : ''}`}
          data-status={status}
          tabIndex={onClick ? 0 : undefined}
        >
          <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 break-words">
            {title}
          </h3>
          <div className="flex items-center gap-2">
            {status && status !== 'healthy' && (
              <span className="sr-only" role="status">
                {status}
              </span>
            )}
            <div className={`w-3 h-3 rounded-full ${getStatusColor()}`} aria-hidden="true" />
          </div>
        </div>

        <div className="flex items-baseline gap-2 mb-2">
          <p className="text-3xl font-bold text-gray-900 dark:text-white break-all">
            {formatValue(value)}
          </p>
          {unit && <span className="text-sm text-gray-500 dark:text-gray-400">{unit}</span>}
        </div>

        {trend !== undefined && (
          <div
            className={`flex items-center text-sm ${
              trend > 0 ? 'text-green-600' : trend < 0 ? 'text-red-600' : 'text-gray-600'
            }`}
            aria-label={getTrendAriaLabel()}
          >
            {trend > 0 ? (
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
            ) : trend < 0 ? (
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            ) : null}
            <span>{Math.abs(trend).toFixed(1)}%</span>
          </div>
        )}
      </div>
    )
  },
)

DataPanel.displayName = 'DataPanel'
