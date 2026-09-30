import { Counter } from './counter.tsx';

export function HomePage(): React.ReactNode {
  return (
    <div>
      <h1>Server rendering experiment</h1>
      <p>
        Rendered on the server at <code>{new Date().toISOString()}</code> in{' '}
        <code>{process.env.NODE_ENV}</code> mode.
      </p>
      <p>
        This timestamp is created while the server component is serialized. The counter below runs
        as a client component.
      </p>
      <h2>Client component embedded below</h2>
      <Counter />
    </div>
  );
}
