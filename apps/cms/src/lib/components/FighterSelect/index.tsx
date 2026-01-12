import type { TextField } from '@revealui/core'
import React from 'react'

// Local type definition for label functions
type LabelFunction = (args: { t: (key: string) => string; i18n?: unknown }) => string

export const FighterSelect: React.FC<TextField> = (props) => {
  const { name, label } = props
  const [options, setOptions] = React.useState<
    {
      label: string
      value: string
    }[]
  >([])

  React.useEffect(() => {
    const initializeFighters = async () => {
      try {
        // Fetch fighters from the users collection via API
        const response = await fetch('/api/collections/users', {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        })

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const result = await response.json()
        const fighters = result.docs || []

        if (Array.isArray(fighters) && fighters.length > 0) {
          const fetchedFighters = fighters.reduce(
            (
              acc: { label: string; value: string }[],
              item: {
                firstName?: string
                lastName?: string
                name?: string
                email: string
                id: string
              },
            ) => {
              // Build label from name fields or fallback to email
              const label =
                item.name ||
                (item.firstName && item.lastName
                  ? `${item.firstName} ${item.lastName}`
                  : item.firstName || item.lastName) ||
                item.email ||
                item.id

              acc.push({
                label,
                value: item.id,
              })
              return acc
            },
            [{ label: 'Select a Fighter', value: '' }],
          )
          setOptions(fetchedFighters)
        } else {
          // No fighters found, set default option
          setOptions([{ label: 'Select a Fighter', value: '' }])
        }
      } catch (error) {
        console.error('Error fetching fighters:', error)
        // Error fetching fighters - set default option
        setOptions([{ label: 'Select a Fighter', value: '' }])
      }
    }

    initializeFighters()
  }, [])
  const labelString =
    typeof label === 'function'
      ? (label as LabelFunction)({ t: () => '', i18n: {} })
      : String(label)

  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium mb-2">
        {labelString}
      </label>
      <select id={name} name={name} className="w-full px-3 py-2 border border-gray-300 rounded-md">
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}
