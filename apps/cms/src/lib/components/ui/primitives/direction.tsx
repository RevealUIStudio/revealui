import React from 'react'

// Define the direction types
type Direction = 'ltr' | 'rtl'

// Create the context
const DirectionContext = React.createContext<Direction | undefined>(undefined)

/* -------------------------------------------------------------------------------------------------
 * Direction Provider
 * -----------------------------------------------------------------------------------------------*/
interface DirectionProviderProps {
  children: React.ReactNode // Make children required for the provider
  dir: Direction // Accept 'ltr' or 'rtl'
}

const DirectionProvider: React.FC<DirectionProviderProps> = ({ dir, children }) => {
  return <DirectionContext.Provider value={dir}>{children}</DirectionContext.Provider>
}

/* -----------------------------------------------------------------------------------------------*/
// Custom hook to use the direction context
const useDirection = (localDir?: Direction): Direction => {
  const globalDir = React.use(DirectionContext)
  return localDir || globalDir || 'ltr' // Fallback to 'ltr' if both are undefined
}

// Export the provider and the hook
export { DirectionProvider, useDirection }
