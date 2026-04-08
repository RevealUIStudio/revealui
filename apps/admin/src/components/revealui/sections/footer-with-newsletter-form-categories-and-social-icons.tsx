import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import { Container } from '@/components/revealui/elements/container';
import { ArrowNarrowRightIcon } from '@/components/revealui/icons/arrow-narrow-right-icon';
import { cn } from '@/lib/utils/cn';

export function FooterCategory({
  title,
  children,
  ...props
}: { title: ReactNode } & ComponentProps<'div'>) {
  return (
    <div {...props}>
      <h3>{title}</h3>
      <ul className="mt-2 flex flex-col gap-2">{children}</ul>
    </div>
  );
}

export function FooterLink({
  href,
  className,
  ...props
}: { href: string } & Omit<ComponentProps<typeof Link>, 'href'>) {
  return (
    <li className={cn('text-mist-700 dark:text-mist-400', className)}>
      <Link href={href} {...props} />
    </li>
  );
}

export function SocialLink({
  href,
  name,
  className,
  ...props
}: {
  href: string;
  name: string;
} & Omit<ComponentProps<'a'>, 'href'>) {
  // Social links can use <a> tags for external links
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={name}
      className={cn('text-mist-950 *:size-6 dark:text-white', className)}
      {...props}
    />
  );
}

export function NewsletterForm({
  headline,
  subheadline,
  className,
  ...props
}: {
  headline: ReactNode;
  subheadline: ReactNode;
} & ComponentProps<'form'>) {
  return (
    <form className={cn('flex max-w-sm flex-col gap-2', className)} {...props}>
      <p>{headline}</p>
      <div className="flex flex-col gap-4 text-mist-700 dark:text-mist-400">{subheadline}</div>
      <div className="flex items-center border-b border-mist-950/20 py-2 has-[input:focus]:border-mist-950 dark:border-white/20 dark:has-[input:focus]:border-white">
        <input
          type="email"
          placeholder="Email"
          aria-label="Email"
          className="flex-1 text-mist-950 focus:outline-hidden dark:text-white"
        />
        <button
          type="submit"
          aria-label="Subscribe"
          className="relative inline-flex size-7 items-center justify-center rounded-full after:absolute after:-inset-2 hover:bg-mist-950/10 dark:hover:bg-white/10 after:pointer-fine:hidden"
        >
          <ArrowNarrowRightIcon />
        </button>
      </div>
    </form>
  );
}

export function FooterWithNewsletterFormCategoriesAndSocialIcons({
  cta,
  links,
  fineprint,
  socialLinks,
  className,
  ...props
}: {
  cta: ReactNode;
  links: ReactNode;
  fineprint: ReactNode;
  socialLinks?: ReactNode;
} & ComponentProps<'footer'>) {
  return (
    <footer className={cn('pt-16', className)} {...props}>
      <div className="bg-mist-950/2.5 py-16 text-mist-950 dark:bg-white/5 dark:text-white">
        <Container className="flex flex-col gap-16">
          <div className="grid grid-cols-1 gap-x-6 gap-y-16 text-sm/7 lg:grid-cols-2">
            {cta}
            <nav className="grid grid-cols-2 gap-6 sm:has-[>:last-child:nth-child(3)]:grid-cols-3 sm:has-[>:nth-child(5)]:grid-cols-3 md:has-[>:last-child:nth-child(4)]:grid-cols-4 lg:max-xl:has-[>:last-child:nth-child(4)]:grid-cols-2">
              {links}
            </nav>
          </div>
          <div className="flex items-center justify-between gap-10 text-sm/7">
            <div className="text-mist-600 dark:text-mist-500">{fineprint}</div>
            {socialLinks && <div className="flex items-center gap-4 sm:gap-10">{socialLinks}</div>}
          </div>
        </Container>
      </div>
    </footer>
  );
}
