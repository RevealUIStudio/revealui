import { Counter } from './counter.tsx';

export function HomePage(): React.ReactNode {
  return (
    <div>
      <h1>Home — Server Component</h1>
      <p>
        Rendered on the server at <code>{new Date().toISOString()}</code> in{' '}
        <code>{process.env.NODE_ENV}</code> mode.
      </p>
      <p>
        The timestamp above is stamped at RSC serialization time, not at request time in the browser
        — proving server execution.
      </p>
      <h2>Client component embedded below</h2>
      <Counter />
    </div>
  );
}
