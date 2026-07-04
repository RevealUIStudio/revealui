// Homepage audience fork — the two technical-mode paths.
// Branch B ("I want it built for me") was removed when the audience toggle
// landed: "built for me" is now the non-technical mode itself (the in-hero
// Technical/Non-technical switch), so this fork only carries the two technical
// paths — build it yourself (A) and build it for your clients (C).
// Original spec: internal non-technical-lane spec (2026-05-14) §4.3.

import { HOME_FORK } from '../../content/home';

export function Fork() {
  const handleSelfBuildScroll = () => {
    if (typeof window === 'undefined') {
      return;
    }
    const fork = document.getElementById('homepage-fork');
    const next = fork?.nextElementSibling;
    if (next instanceof HTMLElement) {
      next.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      // Fallback: scroll one viewport down.
      window.scrollBy({ top: window.innerHeight * 0.9, behavior: 'smooth' });
    }
  };

  return (
    <section id="homepage-fork" aria-label="Choose your path" className="bg-muted py-12 sm:py-16">
      <div className="mx-auto max-w-5xl px-6 lg:px-8">
        <p className="text-center text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-6">
          Two ways to build on RevealUI
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={handleSelfBuildScroll}
            className="group flex flex-col rounded-2xl border border-border bg-card p-6 text-left shadow-sm transition hover:border-primary/50 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <h3 className="text-lg font-semibold leading-7 text-foreground">
              {HOME_FORK.branchA.title}
            </h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{HOME_FORK.branchA.body}</p>
            <p className="mt-4 text-sm font-medium text-primary group-hover:underline underline-offset-4">
              {HOME_FORK.branchA.cta}
            </p>
          </button>

          <a
            href={HOME_FORK.branchC.href}
            className="group flex flex-col rounded-2xl border border-border bg-card p-6 text-left shadow-sm transition hover:border-primary/50 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <h3 className="text-lg font-semibold leading-7 text-foreground">
              {HOME_FORK.branchC.title}
            </h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{HOME_FORK.branchC.body}</p>
            <p className="mt-4 text-sm font-medium text-primary group-hover:underline underline-offset-4">
              {HOME_FORK.branchC.cta}
            </p>
          </a>
        </div>
      </div>
    </section>
  );
}
