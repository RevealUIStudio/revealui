import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import IntentScreen from '../../components/intent/IntentScreen';

describe('IntentScreen', () => {
  it('renders welcome heading and description', () => {
    render(<IntentScreen onSelect={vi.fn()} />);

    expect(screen.getByText('Welcome to RevealUI Studio')).toBeInTheDocument();
    expect(screen.getByText('How would you like to use RevealUI?')).toBeInTheDocument();
  });

  it('renders Deploy and Develop options', () => {
    render(<IntentScreen onSelect={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Deploy' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Develop' })).toBeInTheDocument();
  });

  it('Continue button is disabled when nothing is selected', () => {
    render(<IntentScreen onSelect={vi.fn()} />);

    expect(screen.getByText('Continue')).toBeDisabled();
  });

  it('enables Continue after selecting Deploy', () => {
    render(<IntentScreen onSelect={vi.fn()} />);

    fireEvent.click(screen.getByRole('heading', { name: 'Deploy' }).closest('button')!);
    expect(screen.getByText('Continue')).not.toBeDisabled();
  });

  it('calls onSelect with "deploy" when Deploy is selected and Continue clicked', () => {
    const onSelect = vi.fn();
    render(<IntentScreen onSelect={onSelect} />);

    fireEvent.click(screen.getByRole('heading', { name: 'Deploy' }).closest('button')!);
    fireEvent.click(screen.getByText('Continue'));
    expect(onSelect).toHaveBeenCalledWith('deploy');
  });

  it('calls onSelect with "develop" when Develop is selected and Continue clicked', () => {
    const onSelect = vi.fn();
    render(<IntentScreen onSelect={onSelect} />);

    fireEvent.click(screen.getByRole('heading', { name: 'Develop' }).closest('button')!);
    fireEvent.click(screen.getByText('Continue'));
    expect(onSelect).toHaveBeenCalledWith('develop');
  });
});
