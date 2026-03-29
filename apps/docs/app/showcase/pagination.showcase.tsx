import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@revealui/presentation/server';
import type { ShowcaseStory } from '@/components/showcase/types.js';

const story: ShowcaseStory = {
  slug: 'pagination',
  name: 'Pagination',
  description: 'Page navigation with previous/next, page links, and ellipsis for overflow.',
  category: 'component',

  controls: {
    activePage: {
      type: 'range',
      default: 3,
      min: 1,
      max: 5,
      step: 1,
    },
  },

  render: (props) => {
    const active = props.activePage as number;

    return (
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious />
          </PaginationItem>
          {[1, 2, 3, 4, 5].map((page) => (
            <PaginationItem key={page}>
              <PaginationLink isActive={page === active}>{page}</PaginationLink>
            </PaginationItem>
          ))}
          <PaginationItem>
            <PaginationEllipsis />
          </PaginationItem>
          <PaginationItem>
            <PaginationNext />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    );
  },

  examples: [
    {
      name: 'Simple',
      render: () => (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious />
            </PaginationItem>
            <PaginationItem>
              <PaginationLink isActive>1</PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationLink>2</PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationLink>3</PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationNext />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      ),
    },
  ],

  code: () =>
    `<Pagination>
  <PaginationContent>
    <PaginationItem><PaginationPrevious /></PaginationItem>
    <PaginationItem><PaginationLink isActive>1</PaginationLink></PaginationItem>
    <PaginationItem><PaginationLink>2</PaginationLink></PaginationItem>
    <PaginationItem><PaginationEllipsis /></PaginationItem>
    <PaginationItem><PaginationNext /></PaginationItem>
  </PaginationContent>
</Pagination>`,
};

export default story;
