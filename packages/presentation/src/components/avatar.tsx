import type React from 'react';
import { useDataInteractive } from '../hooks/use-data-interactive.js';
import { cn } from '../utils/cn.js';
import { TouchTarget } from './button-headless.js';
import { Link } from './link.js';

type AvatarProps = {
  src?: string | null | undefined;
  square?: boolean;
  initials?: string;
  alt?: string;
  className?: string;
};

export function Avatar({
  src = null,
  square = false,
  initials,
  alt = '',
  className,
  ...props
}: AvatarProps & React.ComponentPropsWithoutRef<'span'>) {
  const title = alt && alt.trim().length > 0 ? alt.trim() : 'Avatar';

  return (
    <span
      data-slot="avatar"
      {...props}
      className={cn(
        className,
        // Basic layout
        'inline-grid shrink-0 align-middle [--avatar-radius:20%] *:col-start-1 *:row-start-1',
        'outline -outline-offset-1 outline-black/10 dark:outline-white/10',
        // Border radius
        square
          ? 'rounded-(--avatar-radius) *:rounded-(--avatar-radius)'
          : 'rounded-full *:rounded-full',
      )}
    >
      {initials && (
        <svg
          className="size-full fill-current p-[5%] text-[48px] font-medium uppercase select-none"
          viewBox="0 0 100 100"
          aria-hidden={alt && alt.trim().length > 0 ? undefined : 'true'}
        >
          <title>{title}</title>
          <text
            x="50%"
            y="50%"
            alignmentBaseline="middle"
            dominantBaseline="middle"
            textAnchor="middle"
            dy=".125em"
          >
            {initials}
          </text>
        </svg>
      )}
      {/* biome-ignore lint/performance/noImgElement: generic React component, not Next.js */}
      {src && <img className="size-full" src={src} alt={alt} />}
    </span>
  );
}

export function AvatarButton({
  src,
  square = false,
  initials,
  alt,
  className,
  ref,
  ...props
}: AvatarProps & { ref?: React.Ref<HTMLButtonElement> } & (
    | ({
        href?: never;
        disabled?: boolean;
      } & Omit<React.ComponentPropsWithoutRef<'button'>, 'className'>)
    | ({ href: string } & Omit<React.ComponentPropsWithoutRef<typeof Link>, 'className'>)
  )) {
  const disabled = 'disabled' in props ? props.disabled : false;
  const interactiveProps = useDataInteractive({ disabled: disabled ?? false });

  const classes = cn(
    className,
    square ? 'rounded-[20%]' : 'rounded-full',
    'relative inline-grid focus:not-data-focus:outline-hidden data-focus:outline-2 data-focus:outline-offset-2 data-focus:outline-blue-500',
  );

  return typeof props.href === 'string' ? (
    <Link {...props} className={classes} ref={ref as React.Ref<HTMLAnchorElement>}>
      <TouchTarget>
        <Avatar src={src} square={square} initials={initials} alt={alt} />
      </TouchTarget>
    </Link>
  ) : (
    <button type="button" {...props} {...interactiveProps} className={classes} ref={ref}>
      <TouchTarget>
        <Avatar src={src} square={square} initials={initials} alt={alt} />
      </TouchTarget>
    </button>
  );
}
