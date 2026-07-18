import { ButtonCVA } from '@revealui/presentation';
import { HOME_PRIMITIVES, HOME_PRIMITIVES_SECTION } from '../../content/primitives';

// Accent chips must be surface-relative so they adapt under the token-based
// theme (dark-first; light via system pref OR a manual [data-theme] override).
// Translucent bg/ring tint whatever the adaptive card surface is in either
// mode — mirroring the emerald row's bg-primary/10 + text-primary + ring-
// primary/20. We deliberately do NOT use Tailwind `dark:` variants: those are
// media-based and would desync from a manual [data-theme] toggle. emerald rides
// the adaptive brand token; the other four keep their distinct accent hues at
// /10–/20 opacity with a mid-tone icon that reads in both modes.
const accentBg: Record<string, string> = {
  emerald: 'bg-primary/10 text-primary ring-primary/20',
  blue: 'bg-blue-500/10 text-blue-500 ring-blue-500/20',
  amber: 'bg-amber-500/10 text-amber-500 ring-amber-500/20',
  cyan: 'bg-cyan-500/10 text-cyan-500 ring-cyan-500/20',
  violet: 'bg-violet-500/10 text-violet-500 ring-violet-500/20',
};

export function Primitives() {
  return (
    <section className="bg-background py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            {HOME_PRIMITIVES_SECTION.eyebrow}
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {HOME_PRIMITIVES_SECTION.heading}
          </h2>
          <p className="mt-6 text-lg leading-8 text-muted-foreground">
            {HOME_PRIMITIVES_SECTION.body}
          </p>
        </div>

        {/* Alternating feature rows (a zigzag), not a card grid — gives the page
            rhythm. Each primitive is a generous row with a large accent icon that
            alternates sides; the copy hugs toward it. */}
        <div className="mx-auto mt-16 max-w-4xl space-y-10 sm:space-y-14">
          {HOME_PRIMITIVES.map((p, index) => {
            const flipped = index % 2 === 1;
            return (
              <div
                key={p.label}
                className={`flex flex-col gap-5 sm:items-center sm:gap-10 ${
                  flipped ? 'sm:flex-row-reverse' : 'sm:flex-row'
                }`}
              >
                <div
                  className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl ring-1 ${accentBg[p.color]}`}
                >
                  <svg
                    className="h-10 w-10"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <title>{p.label}</title>
                    <path strokeLinecap="round" strokeLinejoin="round" d={p.iconPath} />
                  </svg>
                </div>
                <div className={`flex-1 ${flipped ? 'sm:text-right' : ''}`}>
                  <h3 className="text-xl font-semibold text-foreground">{p.label}</h3>
                  <p className="mt-2 text-base leading-7 text-muted-foreground">{p.body}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-12 text-center">
          <ButtonCVA
            asChild
            appearance="link"
            size="default"
            className="items-center justify-center text-sm font-medium"
          >
            <a href={HOME_PRIMITIVES_SECTION.docsLink.href}>
              {HOME_PRIMITIVES_SECTION.docsLink.label}
            </a>
          </ButtonCVA>
        </div>
      </div>
    </section>
  );
}
