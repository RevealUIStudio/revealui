import { createContext, useContext } from 'react'

export const CloseContext = createContext<(() => void) | null>(null)

export function useCloseContext(): (() => void) | null {
  return useContext(CloseContext)
}
