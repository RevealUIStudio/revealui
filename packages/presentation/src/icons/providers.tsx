/**
 * OAuth provider, social, + passkey icons.
 *
 * Mono icons in `currentColor` — they inherit the parent button's text color so
 * the OAuth row reads as a uniform visual family rather than a multi-color grid.
 * Fleet customers automatically get icons in their brand color when the parent
 * button uses `text-[var(--tenant-brand)]`. For revealui.com's own SaaS surface
 * where multi-color provider marks are preferred, swap to a `variant="brand"`
 * follow-up (separate work).
 *
 * Sizing: defaults to 16x16 via `size-4` class on the consumer. Pass `className`
 * to override (e.g. `className="size-5"`). All paths are simplified for clarity
 * at 16-24px display sizes.
 *
 * Accessibility: rendered as `<svg aria-hidden="true">` since the consuming
 * button provides the accessible label ("Sign in with GitHub"). The icon is
 * decorative redundancy.
 */
import type React from 'react';

type IconProps = React.SVGAttributes<SVGSVGElement> & {
  className?: string;
};

function BaseIcon({
  children,
  className,
  viewBox = '0 0 24 24',
  ...props
}: IconProps & { children: React.ReactNode; viewBox?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={viewBox}
      fill="currentColor"
      aria-hidden="true"
      className={className ?? 'size-4'}
      {...props}
    >
      {children}
    </svg>
  );
}

/** GitHub mark — simplified Octocat silhouette. */
export function GitHubIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M12 .297C5.37.297 0 5.67 0 12.297c0 5.303 3.438 9.8 8.205 11.387.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.385-1.333-1.754-1.333-1.754-1.089-.745.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.807 1.305 3.492.997.108-.775.42-1.305.763-1.605-2.665-.305-5.467-1.334-5.467-5.93 0-1.31.467-2.382 1.235-3.222-.124-.303-.535-1.527.117-3.182 0 0 1.008-.323 3.3 1.23.957-.266 1.98-.398 3-.404 1.02.006 2.04.138 3 .404 2.29-1.553 3.296-1.23 3.296-1.23.654 1.655.243 2.879.12 3.182.77.84 1.234 1.912 1.234 3.222 0 4.61-2.807 5.62-5.48 5.92.43.372.815 1.103.815 2.222 0 1.606-.014 2.898-.014 3.293 0 .323.216.7.825.58C20.565 22.092 24 17.598 24 12.297 24 5.67 18.627.297 12 .297z" />
    </BaseIcon>
  );
}

/** Google mark — simplified G (mono; multi-color variant is a follow-up). */
export function GoogleIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" />
    </BaseIcon>
  );
}

/** LinkedIn mark — square with "in" wordmark. */
export function LinkedInIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.063 2.063 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </BaseIcon>
  );
}

/** Vercel mark — equilateral triangle. */
export function VercelIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M24 22.525H0l12-21.05 12 21.05z" />
    </BaseIcon>
  );
}

/** X (formerly Twitter) mark. */
export function XIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.657l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25h6.826l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </BaseIcon>
  );
}

/**
 * Passkey icon — fingerprint/key composite. Stroke-based (not filled) for
 * distinguishability from the filled provider marks.
 */
export function PasskeyIcon({ className, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className ?? 'size-4'}
      {...props}
    >
      <circle cx="9" cy="9" r="4" />
      <path d="m13 11 5.5 5.5" />
      <path d="m15 14 2.5 2.5L20 14" />
      <path d="m17 16 2.5 2.5" />
    </svg>
  );
}
