import { HOME_DEMO } from '../../content/home';

export function Demo() {
  return (
    <section id="demo" className="bg-secondary py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            {HOME_DEMO.eyebrow}
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {HOME_DEMO.heading}
          </h2>
          <p className="mt-6 text-lg leading-8 text-muted-foreground">{HOME_DEMO.body}</p>
        </div>

        <div className="mx-auto mt-20 grid max-w-5xl grid-cols-1 gap-8 lg:grid-cols-3">
          {HOME_DEMO.beats.map((b) => (
            <div key={b.n} className="rounded-2xl bg-card p-8 ring-1 ring-border">
              <div className="font-mono text-xs font-semibold uppercase tracking-widest text-primary">
                {b.n}
              </div>
              <h3 className="mt-3 text-lg font-semibold text-foreground">{b.title}</h3>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{b.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
