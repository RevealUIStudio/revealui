import { ButtonCVA } from '@revealui/presentation';
import { HOME_PRIMITIVES, HOME_PRIMITIVES_SECTION } from '../../content/primitives';

const accentBg: Record<string, string> = {
  emerald: 'bg-primary/10 text-primary ring-primary/20',
  blue: 'bg-blue-50 text-blue-700 ring-blue-200',
  amber: 'bg-amber-50 text-amber-700 ring-amber-200',
  cyan: 'bg-cyan-50 text-cyan-700 ring-cyan-200',
  violet: 'bg-violet-50 text-violet-700 ring-violet-200',
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

        <div className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
          {HOME_PRIMITIVES.map((p) => (
            <div
              key={p.label}
              className="flex flex-col items-start rounded-2xl bg-card p-6 ring-1 ring-border transition hover:ring-border/80"
            >
              <div
                className={`mb-5 flex h-10 w-10 items-center justify-center rounded-xl ring-1 ${accentBg[p.color]}`}
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.75}
                  stroke="currentColor"
                >
                  <title>{p.label}</title>
                  <path strokeLinecap="round" strokeLinejoin="round" d={p.iconPath} />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-foreground">{p.label}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{p.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <ButtonCVA
            asChild
            variant="link"
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
