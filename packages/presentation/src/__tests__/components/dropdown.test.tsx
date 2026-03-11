/**
 * Dropdown Component Tests
 *
 * Tests the Dropdown compound component including trigger button,
 * menu open/close behavior, items, and subcomponents.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  Dropdown,
  DropdownButton,
  DropdownDescription,
  DropdownDivider,
  DropdownHeading,
  DropdownItem,
  DropdownLabel,
  DropdownMenu,
  DropdownSection,
  DropdownShortcut,
} from '../../components/dropdown.js';

function BasicDropdown({ onItemClick }: { onItemClick?: () => void } = {}) {
  return (
    <Dropdown>
      <DropdownButton>Actions</DropdownButton>
      <DropdownMenu>
        <DropdownItem onClick={onItemClick}>Edit</DropdownItem>
        <DropdownItem>Delete</DropdownItem>
      </DropdownMenu>
    </Dropdown>
  );
}

describe('Dropdown', () => {
  it('should render the trigger button', () => {
    render(<BasicDropdown />);
    expect(screen.getByText('Actions')).toBeInTheDocument();
  });

  it('should set aria-haspopup on the trigger', () => {
    render(<BasicDropdown />);
    const trigger = screen.getByText('Actions');
    expect(trigger.closest('[aria-haspopup="menu"]')).toBeInTheDocument();
  });

  it('should not show menu items when closed', () => {
    render(<BasicDropdown />);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('should open menu on trigger click', async () => {
    const user = userEvent.setup();
    render(<BasicDropdown />);

    await user.click(screen.getByText('Actions'));

    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByText('Edit')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('should set aria-expanded when open', async () => {
    const user = userEvent.setup();
    render(<BasicDropdown />);

    const trigger = screen.getByText('Actions');
    expect(trigger.closest('[aria-expanded]')).toHaveAttribute('aria-expanded', 'false');

    await user.click(trigger);
    expect(trigger.closest('[aria-expanded]')).toHaveAttribute('aria-expanded', 'true');
  });

  it('should close menu on Escape', async () => {
    const user = userEvent.setup();
    render(<BasicDropdown />);

    await user.click(screen.getByText('Actions'));
    expect(screen.getByRole('menu')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
  });

  it('should render items with menuitem role', async () => {
    const user = userEvent.setup();
    render(<BasicDropdown />);

    await user.click(screen.getByText('Actions'));
    const items = screen.getAllByRole('menuitem');
    expect(items).toHaveLength(2);
  });

  it('should call onClick handler and close menu when item is clicked', async () => {
    const user = userEvent.setup();
    const onItemClick = vi.fn();
    render(<BasicDropdown onItemClick={onItemClick} />);

    await user.click(screen.getByText('Actions'));
    await user.click(screen.getByText('Edit'));

    expect(onItemClick).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
  });
});

describe('DropdownLabel and DropdownDescription', () => {
  it('should render label and description within an item', async () => {
    const user = userEvent.setup();
    render(
      <Dropdown>
        <DropdownButton>Menu</DropdownButton>
        <DropdownMenu>
          <DropdownItem>
            <DropdownLabel>Settings</DropdownLabel>
            <DropdownDescription>Manage your preferences</DropdownDescription>
          </DropdownItem>
        </DropdownMenu>
      </Dropdown>,
    );

    await user.click(screen.getByText('Menu'));
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('Manage your preferences')).toBeInTheDocument();
  });
});

describe('DropdownSection and DropdownHeading', () => {
  it('should render a section with a heading', async () => {
    const user = userEvent.setup();
    render(
      <Dropdown>
        <DropdownButton>Menu</DropdownButton>
        <DropdownMenu>
          <DropdownSection>
            <DropdownHeading>Account</DropdownHeading>
            <DropdownItem>Profile</DropdownItem>
          </DropdownSection>
        </DropdownMenu>
      </Dropdown>,
    );

    await user.click(screen.getByText('Menu'));
    expect(screen.getByText('Account')).toBeInTheDocument();
    expect(screen.getByRole('group')).toBeInTheDocument();
  });
});

describe('DropdownDivider', () => {
  it('should render an hr element', async () => {
    const user = userEvent.setup();
    render(
      <Dropdown>
        <DropdownButton>Menu</DropdownButton>
        <DropdownMenu>
          <DropdownItem>Item 1</DropdownItem>
          <DropdownDivider data-testid="divider" />
          <DropdownItem>Item 2</DropdownItem>
        </DropdownMenu>
      </Dropdown>,
    );

    await user.click(screen.getByText('Menu'));
    expect(screen.getByTestId('divider').tagName).toBe('HR');
  });
});

describe('DropdownShortcut', () => {
  it('should render keyboard shortcut characters', async () => {
    const user = userEvent.setup();
    render(
      <Dropdown>
        <DropdownButton>Menu</DropdownButton>
        <DropdownMenu>
          <DropdownItem>
            <DropdownLabel>Copy</DropdownLabel>
            <DropdownShortcut keys={['Ctrl', 'C']} data-testid="shortcut" />
          </DropdownItem>
        </DropdownMenu>
      </Dropdown>,
    );

    await user.click(screen.getByText('Menu'));
    const shortcut = screen.getByTestId('shortcut');
    expect(shortcut).toHaveTextContent('Ctrl');
    expect(shortcut).toHaveTextContent('C');
  });
});
