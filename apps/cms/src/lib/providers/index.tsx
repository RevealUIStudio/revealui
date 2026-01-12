import { ElectricProvider } from '@revealui/sync/provider'
import type React from 'react'
import { HeaderThemeProvider } from './HeaderTheme'
import { ThemeProvider } from './Theme'

export const Providers: React.FC<{
  children: React.ReactNode
}> = ({ children }) => {
  return (
    <ElectricProvider
      serviceUrl={process.env.NEXT_PUBLIC_ELECTRIC_SERVICE_URL}
      debug={process.env.NODE_ENV === 'development'}
    >
      <ThemeProvider>
        <HeaderThemeProvider>{children}</HeaderThemeProvider>
      </ThemeProvider>
    </ElectricProvider>
  )
}
