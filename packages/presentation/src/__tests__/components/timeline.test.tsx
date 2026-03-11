import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Timeline, TimelineItem } from '../../components/timeline.js';

describe('Timeline', () => {
  it('renders timeline items', () => {
    render(
      <Timeline>
        <TimelineItem title="Event 1" />
        <TimelineItem title="Event 2" />
      </Timeline>,
    );
    expect(screen.getByText('Event 1')).toBeInTheDocument();
    expect(screen.getByText('Event 2')).toBeInTheDocument();
  });

  it('renders date when provided', () => {
    render(
      <Timeline>
        <TimelineItem title="Meeting" date="March 15, 2024" />
      </Timeline>,
    );
    expect(screen.getByText('March 15, 2024')).toBeInTheDocument();
  });

  it('renders description when provided', () => {
    render(
      <Timeline>
        <TimelineItem title="Release" description="Version 2.0 shipped" />
      </Timeline>,
    );
    expect(screen.getByText('Version 2.0 shipped')).toBeInTheDocument();
  });
});
