/** SVG icons for tile gallery — one per tile id prefix or category. */
export default function TileIcon({ tileId }: { tileId: string }) {
  const cls = 'size-5 shrink-0';

  // Editor
  if (tileId === 'zed') {
    return (
      <svg
        className={cls}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        aria-hidden="true"
      >
        <path d="M13 3L4 14h7l-1 7 9-11h-7l1-7Z" />
      </svg>
    );
  }

  // Terminal variants
  if (tileId === 'revealui-tmux' || tileId === 'wsl') {
    return (
      <svg
        className={cls}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        aria-hidden="true"
      >
        <polyline points="4 17 10 11 4 5" />
        <line x1="12" x2="20" y1="19" y2="19" />
      </svg>
    );
  }
  if (tileId === 'powershell') {
    return (
      <svg
        className={cls}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        aria-hidden="true"
      >
        <path d="M4 17l6-5-6-5" />
        <path d="M12 19h8" />
      </svg>
    );
  }

  // AI
  if (tileId.startsWith('claude')) {
    return (
      <svg
        className={cls}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v4m0 12v4m10-10h-4M6 12H2m15.07-7.07-2.83 2.83M9.76 14.24l-2.83 2.83m12.14 0-2.83-2.83M9.76 9.76 6.93 6.93" />
      </svg>
    );
  }

  // Browser
  if (tileId.startsWith('chrome') || tileId.startsWith('edge')) {
    return (
      <svg
        className={cls}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="4" />
        <line x1="21.17" x2="12" y1="8" y2="8" />
        <line x1="3.95" x2="8.54" y1="6.06" y2="14" />
        <line x1="10.88" x2="15.46" y1="21.94" y2="14" />
      </svg>
    );
  }

  // GitHub
  if (tileId === 'github') {
    return (
      <svg
        className={cls}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        aria-hidden="true"
      >
        <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.4 5.4 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65S8.93 17.38 9 18v4" />
        <path d="M9 18c-4.51 2-5-2-7-2" />
      </svg>
    );
  }

  // Vercel
  if (tileId.startsWith('vercel')) {
    return (
      <svg
        className={cls}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        aria-hidden="true"
      >
        <path d="M12 2L2 19.5h20L12 2Z" />
      </svg>
    );
  }

  // npm
  if (tileId.startsWith('npm')) {
    return (
      <svg
        className={cls}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        aria-hidden="true"
      >
        <rect x="2" y="5" width="20" height="14" rx="1" />
        <path d="M7 10v4m5-6v6m5-4v4" />
      </svg>
    );
  }

  // Stripe
  if (tileId.startsWith('stripe')) {
    return (
      <svg
        className={cls}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        aria-hidden="true"
      >
        <path d="M12 2v20M2 12h20" />
        <path d="M17 7l-5 5-5-5" />
        <rect x="3" y="3" width="18" height="18" rx="2" />
      </svg>
    );
  }

  // Neon
  if (tileId.startsWith('neon')) {
    return (
      <svg
        className={cls}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        aria-hidden="true"
      >
        <ellipse cx="12" cy="6" rx="8" ry="3" />
        <path d="M4 6v6c0 1.66 3.58 3 8 3s8-1.34 8-3V6" />
        <path d="M4 12v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6" />
      </svg>
    );
  }

  // Supabase
  if (tileId.startsWith('supabase')) {
    return (
      <svg
        className={cls}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        aria-hidden="true"
      >
        <path d="M13.5 21.3c-.4.5-1.2.1-1.2-.6V13h7.6c.9 0 1.3-1.1.7-1.7L11.5 2.7c-.4-.5-1.2-.1-1.2.6V11H2.7c-.9 0-1.3 1.1-.7 1.7l9 8.6Z" />
      </svg>
    );
  }

  // Fallback: generic launch icon
  return (
    <svg
      className={cls}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden="true"
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" x2="21" y1="14" y2="3" />
    </svg>
  );
}
