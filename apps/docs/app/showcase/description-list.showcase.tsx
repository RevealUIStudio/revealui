import {
  DescriptionDetails,
  DescriptionList,
  DescriptionTerm,
} from '@revealui/presentation/client';
import type { ShowcaseStory } from '@/components/showcase/types.js';

const story: ShowcaseStory = {
  slug: 'description-list',
  name: 'Description List',
  description: 'Semantic definition list with styled terms and details.',
  category: 'component',

  controls: {},

  render: () => (
    <DescriptionList>
      <DescriptionTerm>Framework</DescriptionTerm>
      <DescriptionDetails>React 19</DescriptionDetails>
      <DescriptionTerm>Language</DescriptionTerm>
      <DescriptionDetails>TypeScript 6</DescriptionDetails>
      <DescriptionTerm>Package Manager</DescriptionTerm>
      <DescriptionDetails>pnpm 10</DescriptionDetails>
    </DescriptionList>
  ),

  examples: [
    {
      name: 'Account Details',
      render: () => (
        <DescriptionList>
          <DescriptionTerm>Email</DescriptionTerm>
          <DescriptionDetails>founder@revealui.com</DescriptionDetails>
          <DescriptionTerm>Plan</DescriptionTerm>
          <DescriptionDetails>Pro ($49/mo)</DescriptionDetails>
          <DescriptionTerm>Sites</DescriptionTerm>
          <DescriptionDetails>3 of 5</DescriptionDetails>
        </DescriptionList>
      ),
    },
  ],

  code: () =>
    `<DescriptionList>
  <DescriptionTerm>Label</DescriptionTerm>
  <DescriptionDetails>Value</DescriptionDetails>
</DescriptionList>`,
};

export default story;
