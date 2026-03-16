import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import DriveInfo from '../../components/devbox/DriveInfo';
import type { MountStatus } from '../../types';

const MOUNTED_DRIVE: MountStatus = {
  mounted: true,
  mount_point: '/mnt/wsl-dev',
  device: '/dev/sdc',
  size_total: '1T',
  size_used: '500G',
  size_available: '500G',
  use_percent: '50%',
};

const UNMOUNTED_DRIVE: MountStatus = {
  mounted: false,
  mount_point: '/mnt/wsl-dev',
  device: null,
  size_total: null,
  size_used: null,
  size_available: null,
  use_percent: null,
};

describe('DriveInfo', () => {
  it('renders "Drive Info" heading', () => {
    render(<DriveInfo mount={MOUNTED_DRIVE} />);
    expect(screen.getByText('Drive Info')).toBeInTheDocument();
  });

  it('shows "Mounted" for mounted drive', () => {
    render(<DriveInfo mount={MOUNTED_DRIVE} />);
    expect(screen.getByText('Mounted')).toBeInTheDocument();
  });

  it('shows "Not Mounted" for unmounted drive', () => {
    render(<DriveInfo mount={UNMOUNTED_DRIVE} />);
    expect(screen.getByText('Not Mounted')).toBeInTheDocument();
  });

  it('displays mount point', () => {
    render(<DriveInfo mount={MOUNTED_DRIVE} />);
    expect(screen.getByText('/mnt/wsl-dev')).toBeInTheDocument();
  });

  it('displays device when present', () => {
    render(<DriveInfo mount={MOUNTED_DRIVE} />);
    expect(screen.getByText('/dev/sdc')).toBeInTheDocument();
  });

  it('does not display device when null', () => {
    render(<DriveInfo mount={UNMOUNTED_DRIVE} />);
    expect(screen.queryByText('/dev/sdc')).not.toBeInTheDocument();
  });

  it('displays size information when available', () => {
    render(<DriveInfo mount={MOUNTED_DRIVE} />);
    expect(screen.getByText('1T')).toBeInTheDocument();
    expect(screen.getByText('500G')).toBeInTheDocument();
  });

  it('does not display size information when null', () => {
    render(<DriveInfo mount={UNMOUNTED_DRIVE} />);
    expect(screen.queryByText('Total')).not.toBeInTheDocument();
    expect(screen.queryByText('Available')).not.toBeInTheDocument();
  });
});
