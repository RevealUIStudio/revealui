// Homepage audience fork — Phase 2 of the non-technical-lane spec.
// Spec: ~/revfleet/.jv/docs/spec-2026-05-14-non-technical-lane.md §4.3.
// Decisions: §9.4 OQ-5 — Branch A stays on / (scroll-past); not a route change.
//
// Implementation note (Phase 2): placed AFTER <Hero /> in HomePage.tsx as a
// separate component rather than INSIDE the existing Hero. This avoids
// merge-conflict with peer PR #1141 which is editing HOME_HERO copy. The
// spec's §4.3 ideal placement is "above the first scroll boundary" inside
// the hero viewport; this implementation puts the fork as the next-band
// after Hero, which is visible after a small scroll on most viewports.
// Trade-off: marginally lower first-paint visibility for the fork in
// exchange for zero collision with in-flight peer work. Revisit after #1141
// lands if a stricter hero-internal placement is desired.

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
          Three ways to use RevealUI
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <button
            type="button"
            onClick={handleSelfBuildScroll}
            className="group rounded-2xl border border-border bg-card p-6 text-left shadow-sm transition hover:border-primary/50 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
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
            href={HOME_FORK.branchB.href}
            className="group rounded-2xl border border-border bg-card p-6 text-left shadow-sm transition hover:border-primary/50 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <h3 className="text-lg font-semibold leading-7 text-foreground">
              {HOME_FORK.branchB.title}
            </h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{HOME_FORK.branchB.body}</p>
            <p className="mt-4 text-sm font-medium text-primary group-hover:underline underline-offset-4">
              {HOME_FORK.branchB.cta}
            </p>
          </a>

          <a
            href={HOME_FORK.branchC.href}
            className="group rounded-2xl border border-border bg-card p-6 text-left shadow-sm transition hover:border-primary/50 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
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
