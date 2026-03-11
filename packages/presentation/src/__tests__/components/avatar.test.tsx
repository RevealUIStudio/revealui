/**
 * Avatar Component Tests
 *
 * Tests for Avatar and AvatarButton components including image rendering,
 * initials fallback, square variant, and interactive button/link behavior.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Avatar, AvatarButton } from '../../components/avatar.js';

describe('Avatar', () => {
  describe('Rendering with image', () => {
    it('should render an img element when src is provided', () => {
      render(<Avatar src="/photo.jpg" alt="User photo" />);

      const img = screen.getByRole('img', { name: 'User photo' });
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('src', '/photo.jpg');
    });

    it('should pass alt text to the img element', () => {
      render(<Avatar src="/photo.jpg" alt="Jane Doe" />);

      const img = screen.getByRole('img', { name: 'Jane Doe' });
      expect(img).toHaveAttribute('alt', 'Jane Doe');
    });
  });

  describe('Rendering with initials', () => {
    it('should render an SVG with initials when no src is provided', () => {
      const { container } = render(<Avatar initials="JD" />);

      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();

      const text = container.querySelector('text');
      expect(text).toHaveTextContent('JD');
    });

    it('should render initials SVG with title', () => {
      const { container } = render(<Avatar initials="AB" alt="Alice Brown" />);

      const title = container.querySelector('title');
      expect(title).toHaveTextContent('Alice Brown');
    });

    it('should default title to "Avatar" when alt is empty', () => {
      const { container } = render(<Avatar initials="XY" />);

      const title = container.querySelector('title');
      expect(title).toHaveTextContent('Avatar');
    });
  });

  describe('Square variant', () => {
    it('should apply rounded-full by default', () => {
      const { container } = render(<Avatar initials="JD" />);

      const wrapper = container.querySelector('[data-slot="avatar"]');
      expect(wrapper).toHaveClass('rounded-full');
    });

    it('should not apply rounded-full when square is true', () => {
      const { container } = render(<Avatar initials="JD" square />);

      const wrapper = container.querySelector('[data-slot="avatar"]');
      expect(wrapper).not.toHaveClass('rounded-full');
    });
  });

  describe('Custom className', () => {
    it('should apply custom className to the wrapper', () => {
      const { container } = render(<Avatar initials="JD" className="custom-avatar" />);

      const wrapper = container.querySelector('[data-slot="avatar"]');
      expect(wrapper).toHaveClass('custom-avatar');
    });
  });

  describe('Both src and initials', () => {
    it('should render both img and SVG when both are provided', () => {
      const { container } = render(<Avatar src="/photo.jpg" initials="JD" alt="User" />);

      const img = screen.getByRole('img', { name: 'User' });
      expect(img).toBeInTheDocument();

      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });
  });
});

describe('AvatarButton', () => {
  describe('As button', () => {
    it('should render as a button element when no href is provided', () => {
      render(<AvatarButton initials="JD" />);

      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      expect(button.tagName).toBe('BUTTON');
    });

    it('should have type="button"', () => {
      render(<AvatarButton initials="JD" />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('type', 'button');
    });

    it('should call onClick when clicked', async () => {
      const handleClick = vi.fn();
      const user = userEvent.setup();

      render(<AvatarButton initials="JD" onClick={handleClick} />);

      const button = screen.getByRole('button');
      await user.click(button);

      expect(handleClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('As link', () => {
    it('should render as an anchor element when href is provided', () => {
      render(<AvatarButton initials="JD" href="/profile" />);

      const link = screen.getByRole('link');
      expect(link).toBeInTheDocument();
      expect(link.tagName).toBe('A');
      expect(link).toHaveAttribute('href', '/profile');
    });
  });

  describe('Avatar rendering within button', () => {
    it('should render the inner Avatar with provided props', () => {
      const { container } = render(<AvatarButton src="/photo.jpg" alt="User photo" />);

      const img = screen.getByRole('img', { name: 'User photo' });
      expect(img).toBeInTheDocument();

      const avatarSlot = container.querySelector('[data-slot="avatar"]');
      expect(avatarSlot).toBeInTheDocument();
    });
  });
});
