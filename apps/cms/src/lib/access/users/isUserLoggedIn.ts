import type { AccessFunction, AccessArgs } from '@revealui/cms'

export const isUserLoggedIn: AccessFunction = ({ req }: AccessArgs) => {
  return Boolean(req?.user)
}
