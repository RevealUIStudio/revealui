/**
 * DescriptionList Component Tests
 *
 * Tests the DescriptionList, DescriptionTerm, and DescriptionDetails components.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  DescriptionDetails,
  DescriptionList,
  DescriptionTerm,
} from '../../components/description-list.js';

describe('DescriptionList', () => {
  it('should render a dl element', () => {
    render(<DescriptionList data-testid="dl">Content</DescriptionList>);
    expect(screen.getByTestId('dl').tagName).toBe('DL');
  });

  it('should render children', () => {
    render(<DescriptionList>List content</DescriptionList>);
    expect(screen.getByText('List content')).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    render(
      <DescriptionList className="custom" data-testid="dl">
        Content
      </DescriptionList>,
    );
    expect(screen.getByTestId('dl')).toHaveClass('custom');
  });
});

describe('DescriptionTerm', () => {
  it('should render a dt element', () => {
    render(
      <DescriptionList>
        <DescriptionTerm>Full name</DescriptionTerm>
      </DescriptionList>,
    );
    expect(screen.getByText('Full name').tagName).toBe('DT');
  });

  it('should apply custom className', () => {
    render(
      <DescriptionList>
        <DescriptionTerm className="term-class">Label</DescriptionTerm>
      </DescriptionList>,
    );
    expect(screen.getByText('Label')).toHaveClass('term-class');
  });
});

describe('DescriptionDetails', () => {
  it('should render a dd element', () => {
    render(
      <DescriptionList>
        <DescriptionDetails>John Doe</DescriptionDetails>
      </DescriptionList>,
    );
    expect(screen.getByText('John Doe').tagName).toBe('DD');
  });

  it('should apply custom className', () => {
    render(
      <DescriptionList>
        <DescriptionDetails className="detail-class">Value</DescriptionDetails>
      </DescriptionList>,
    );
    expect(screen.getByText('Value')).toHaveClass('detail-class');
  });
});

describe('DescriptionList composition', () => {
  it('should render a complete definition list', () => {
    render(
      <DescriptionList data-testid="dl">
        <DescriptionTerm>Name</DescriptionTerm>
        <DescriptionDetails>Alice</DescriptionDetails>
        <DescriptionTerm>Email</DescriptionTerm>
        <DescriptionDetails>alice@example.com</DescriptionDetails>
      </DescriptionList>,
    );

    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('alice@example.com')).toBeInTheDocument();
  });
});
