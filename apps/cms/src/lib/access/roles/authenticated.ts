import type { AccessFunction, AccessArgs } from '@revealui/cms'

export const authenticated: AccessFunction = ({ req }: AccessArgs) => {
  return Boolean(req?.user)
}
