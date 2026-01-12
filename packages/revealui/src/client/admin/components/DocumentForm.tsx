'use client'
import type React from 'react'
import { useState } from 'react'
import type {
  RevealCollectionConfig,
  RevealDocument,
  RevealUIField,
} from '../../../core/types/index'

// Helper to resolve field label to a string
function getFieldLabel(field: RevealUIField): string {
  if (typeof field.label === 'function') {
    return field.label({ t: (key: string) => key })
  }
  if (typeof field.label === 'string') {
    return field.label
  }
  return field.name || 'Field'
}

interface DocumentFormProps {
  collection: RevealCollectionConfig
  document?: RevealDocument
  onSave: (data: Record<string, any>) => void
  onCancel: () => void
  isLoading?: boolean
}

export function DocumentForm({
  collection,
  document,
  onSave,
  onCancel,
  isLoading = false,
}: DocumentFormProps) {
  const [formData, setFormData] = useState<Record<string, any>>(document || {})

  const visibleFields = collection.fields.filter(
    (field) => field.admin?.position !== 'sidebar' && !field.admin?.hidden,
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
  }

  const handleFieldChange = (fieldName: string, value: any) => {
    setFormData((prev) => ({ ...prev, [fieldName]: value }))
  }

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
          {document ? 'Edit' : 'Create'} {collection.slug.slice(0, -1)}
        </h3>

        <form onSubmit={handleSubmit} className="space-y-6">
          {visibleFields.map((field) => (
            <div key={field.name || 'layout'}>
              <label htmlFor={field.name} className="block text-sm font-medium text-gray-700">
                {getFieldLabel(field)}
                {field.required && <span className="text-red-500 ml-1">*</span>}
              </label>
              <div className="mt-1">
                <FieldInput
                  field={field}
                  value={field.name ? formData[field.name] : undefined}
                  onChange={(value) => field.name && handleFieldChange(field.name, value)}
                />
              </div>
            </div>
          ))}

          <div className="flex justify-end space-x-3 pt-6">
            <button
              type="button"
              onClick={onCancel}
              className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

interface FieldInputProps {
  field: RevealUIField
  value: any
  onChange: (value: any) => void
}

function FieldInput({ field, value, onChange }: FieldInputProps) {
  const baseClasses =
    'mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm'

  switch (field.type) {
    case 'text':
      return (
        <input
          type="text"
          id={field.name}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className={baseClasses}
          required={field.required}
        />
      )

    case 'textarea':
      return (
        <textarea
          id={field.name}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          className={baseClasses}
          required={field.required}
        />
      )

    case 'number':
      return (
        <input
          type="number"
          id={field.name}
          value={value || ''}
          onChange={(e) => onChange(Number(e.target.value) || undefined)}
          className={baseClasses}
          required={field.required}
          min={field.min}
          max={field.max}
        />
      )

    case 'checkbox':
      return (
        <input
          type="checkbox"
          id={field.name}
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
        />
      )

    case 'select':
      return (
        <select
          id={field.name}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className={baseClasses}
          required={field.required}
        >
          <option value="">Select an option</option>
          {field.options?.map((option: any) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )

    case 'date':
      return (
        <input
          type="datetime-local"
          id={field.name}
          value={value ? new Date(value).toISOString().slice(0, 16) : ''}
          onChange={(e) => onChange(e.target.value ? new Date(e.target.value) : null)}
          className={baseClasses}
          required={field.required}
        />
      )

    default:
      return (
        <input
          type="text"
          id={field.name}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className={baseClasses}
          required={field.required}
        />
      )
  }
}
