// Three-actors explainer. Defines developer / operator / agent before the
// audience fork uses those roles. Rendered between <Hero /> and <Fork /> in
// HomePage.tsx so the hero's "agents" is defined within one scroll.

import { HOME_ACTORS } from '../../content/home';

export function Actors() {
  return (
    <section aria-label="Who does what in RevealUI" className="bg-background py-12 sm:py-16">
      <div className="mx-auto max-w-5xl px-6 lg:px-8">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">
            {HOME_ACTORS.eyebrow}
          </p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {HOME_ACTORS.heading}
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            {HOME_ACTORS.body}
          </p>
        </div>
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {HOME_ACTORS.actors.map((actor) => (
            <div
              key={actor.role}
              className="rounded-2xl border border-border bg-card p-6 text-left shadow-sm"
            >
              <h3 className="text-lg font-semibold leading-7 text-foreground">
                <span className="text-primary">{actor.role}</span> {actor.action}
              </h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{actor.body}</p>
            </div>
          ))}
        </div>
        <p className="mt-8 text-center text-base font-medium text-foreground">
          {HOME_ACTORS.tagline}
        </p>
      </div>
    </section>
  );
}
