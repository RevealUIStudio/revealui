import type { AccessArgs, AccessFunction } from '@revealui/core'

export const authenticatedOrPublished: AccessFunction = ({ req }: AccessArgs) => {
  if (req?.user) {
    return true
  }

  return {
    // biome-ignore lint/style/useNamingConvention: _status is a RevealUI CMS query field required by the framework
    _status: {
      equals: 'published',
    },
  }
}
