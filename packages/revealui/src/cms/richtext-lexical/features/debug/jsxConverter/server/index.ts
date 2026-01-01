import { createServerFeature } from "../../../../utilities/createServerFeature";


export const DebugJsxConverterFeature = createServerFeature({
  feature: {
    ClientFeature: '@revealui/cms/richtext-lexical/client#DebugJsxConverterFeatureClient',
  },
  key: 'jsxConverter',
})
