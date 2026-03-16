import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
}));

vi.mock('../../lib/invoke', () => ({
  sshBookmarkList: vi.fn().mockResolvedValue([]),
  sshBookmarkSave: vi.fn().mockResolvedValue(undefined),
  sshBookmarkDelete: vi.fn().mockResolvedValue(undefined),
}));

import ConnectForm from '../../components/terminal/ConnectForm';

describe('ConnectForm', () => {
  it('renders Host and Port inputs', () => {
    render(<ConnectForm onConnect={vi.fn()} connecting={false} />);
    expect(screen.getByLabelText('Host')).toBeInTheDocument();
    expect(screen.getByLabelText('Port')).toBeInTheDocument();
  });

  it('renders Username input', () => {
    render(<ConnectForm onConnect={vi.fn()} connecting={false} />);
    expect(screen.getByLabelText('Username')).toBeInTheDocument();
  });

  it('defaults to SSH Key authentication method', () => {
    render(<ConnectForm onConnect={vi.fn()} connecting={false} />);
    expect(screen.getByText('SSH Key')).toBeInTheDocument();
    expect(screen.getByText('Password')).toBeInTheDocument();
  });

  it('shows key file input by default', () => {
    render(<ConnectForm onConnect={vi.fn()} connecting={false} />);
    expect(screen.getByLabelText('Key file')).toBeInTheDocument();
    expect(screen.getByText('Browse')).toBeInTheDocument();
  });

  it('switches to password input when Password auth is selected', () => {
    render(<ConnectForm onConnect={vi.fn()} connecting={false} />);
    fireEvent.click(screen.getByText('Password'));
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
  });

  it('shows passphrase field in key mode', () => {
    render(<ConnectForm onConnect={vi.fn()} connecting={false} />);
    expect(screen.getByLabelText(/Passphrase/)).toBeInTheDocument();
  });

  it('shows hint text for optional passphrase', () => {
    render(<ConnectForm onConnect={vi.fn()} connecting={false} />);
    expect(screen.getByText('(optional)')).toBeInTheDocument();
  });

  it('disables Connect when form is incomplete', () => {
    render(<ConnectForm onConnect={vi.fn()} connecting={false} />);
    const connectButton = screen.getByText('Connect').closest('button');
    expect(connectButton).toBeDisabled();
  });

  it('enables Connect when key auth fields are filled', () => {
    render(<ConnectForm onConnect={vi.fn()} connecting={false} />);
    fireEvent.change(screen.getByLabelText('Host'), { target: { value: '192.168.1.1' } });
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText('Key file'), {
      target: { value: '~/.ssh/id_ed25519' },
    });
    const connectButton = screen.getByText('Connect').closest('button');
    expect(connectButton).not.toBeDisabled();
  });

  it('shows loading state when connecting', () => {
    render(<ConnectForm onConnect={vi.fn()} connecting={true} />);
    const connectButton = screen.getByText('Connect').closest('button');
    expect(connectButton).toBeDisabled();
  });
});
