'use client';

import { createContext, useContext } from 'react';

type ServerFunction = (name: string, args: unknown) => Promise<unknown>;

const ServerFunctionContext = createContext<ServerFunction | null>(null);

export function ServerFunctionProvider({
  children,
  serverFunction,
}: {
  children: React.ReactNode;
  serverFunction?: ServerFunction;
}) {
  return <ServerFunctionContext value={serverFunction ?? null}>{children}</ServerFunctionContext>;
}

export function useServerFunction(): ServerFunction {
  const fn = useContext(ServerFunctionContext);
  if (!fn) {
    throw new Error(
      'useServerFunction must be used within a ServerFunctionProvider. ' +
        'Pass serverFunction prop to RootLayout.',
    );
  }
  return fn;
}
