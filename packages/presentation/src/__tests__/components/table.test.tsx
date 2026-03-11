/**
 * Table Component Tests
 *
 * Tests the Table compound component including Table, TableHead,
 * TableBody, TableRow, TableHeader, TableCell, and their context-driven props.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/table.js';

function BasicTable({
  dense,
  striped,
  grid,
  bleed,
}: {
  dense?: boolean;
  striped?: boolean;
  grid?: boolean;
  bleed?: boolean;
} = {}) {
  return (
    <Table dense={dense} striped={striped} grid={grid} bleed={bleed}>
      <TableHead>
        <TableRow>
          <TableHeader>Name</TableHeader>
          <TableHeader>Email</TableHeader>
        </TableRow>
      </TableHead>
      <TableBody>
        <TableRow>
          <TableCell>Alice</TableCell>
          <TableCell>alice@example.com</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>Bob</TableCell>
          <TableCell>bob@example.com</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}

describe('Table', () => {
  it('should render a table element', () => {
    render(<BasicTable />);
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('should render headers and cells', () => {
    render(<BasicTable />);
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('bob@example.com')).toBeInTheDocument();
  });

  it('should render column headers in th elements', () => {
    render(<BasicTable />);
    const headers = screen.getAllByRole('columnheader');
    expect(headers).toHaveLength(2);
    expect(headers[0]).toHaveTextContent('Name');
    expect(headers[1]).toHaveTextContent('Email');
  });

  it('should render body cells in td elements', () => {
    render(<BasicTable />);
    const cells = screen.getAllByRole('cell');
    expect(cells).toHaveLength(4);
  });

  it('should render rows', () => {
    render(<BasicTable />);
    // thead row + 2 tbody rows
    const rows = screen.getAllByRole('row');
    expect(rows).toHaveLength(3);
  });
});

describe('Table with dense prop', () => {
  it('should apply dense styling to cells', () => {
    render(<BasicTable dense />);
    const cells = screen.getAllByRole('cell');
    // Dense cells get py-2.5 instead of py-4
    expect(cells[0].className).toContain('py-2.5');
  });
});

describe('Table with striped prop', () => {
  it('should apply striped styling to rows', () => {
    render(<BasicTable striped />);
    const rows = screen.getAllByRole('row');
    // Body rows (index 1 and 2) get striped classes
    const bodyRow = rows[1];
    expect(bodyRow.className).toContain('even:bg-zinc-950/2.5');
  });

  it('should omit bottom border on cells when striped', () => {
    render(<BasicTable striped />);
    const cells = screen.getAllByRole('cell');
    // Striped cells do NOT get the border-b class
    expect(cells[0].className).not.toContain('border-b');
  });
});

describe('Table with grid prop', () => {
  it('should apply grid border styling to headers', () => {
    render(<BasicTable grid />);
    const headers = screen.getAllByRole('columnheader');
    expect(headers[0].className).toContain('border-l');
  });

  it('should apply grid border styling to cells', () => {
    render(<BasicTable grid />);
    const cells = screen.getAllByRole('cell');
    expect(cells[0].className).toContain('border-l');
  });
});

describe('Table with bleed prop', () => {
  it('should not apply sm:px-(--gutter) when bleed is true', () => {
    const { container } = render(<BasicTable bleed />);
    const innerWrapper = container.querySelector('.inline-block');
    expect(innerWrapper?.className).not.toContain('sm:px-(--gutter)');
  });
});

describe('TableRow with href', () => {
  it('should render a link inside the first cell when href is provided', () => {
    render(
      <Table>
        <TableBody>
          <TableRow href="/users/1" title="View Alice">
            <TableCell>Alice</TableCell>
            <TableCell>alice@example.com</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    const links = screen.getAllByRole('link', { name: 'View Alice' });
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute('href', '/users/1');
    expect(links[1]).toHaveAttribute('href', '/users/1');
  });
});
