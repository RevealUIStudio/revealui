import React from 'react';

function createContext<ContextValueType extends object | null>(
  rootComponentName: string,
  defaultContext?: ContextValueType,
) {
  const Context = React.createContext<ContextValueType | undefined>(defaultContext);

  const Provider = (props: ContextValueType & { children: React.ReactNode }) => {
    const { children, ...context } = props;
    // Only re-memoize when prop values change
    // biome-ignore lint/correctness/useExhaustiveDependencies: context is intentionally used as dependency for memoization
    const value = React.useMemo(() => context, [context]) as ContextValueType;
    return <Context.Provider value={value}>{children}</Context.Provider>;
  };

  Provider.displayName = `${rootComponentName}Provider`;

  function useContextValue(consumerName: string) {
    const context = React.use(Context);
    if (context) return context;
    if (defaultContext !== undefined) return defaultContext;
    // if a defaultContext wasn't specified, it's a required context.
    throw new Error(`\`${consumerName}\` must be used within \`${rootComponentName}\``);
  }

  return [Provider, useContextValue] as const;
}

/* -------------------------------------------------------------------------------------------------
 * createContextScope
 * -----------------------------------------------------------------------------------------------*/

type Scope<C = unknown> = { [scopeName: string]: React.Context<C>[] } | undefined;
type ScopeHook = (scope: Scope) => { [__scopeProp: string]: Scope };
interface CreateScope {
  scopeName: string;
  (): ScopeHook;
}

function createContextScope(scopeName: string, createContextScopeDeps: CreateScope[] = []) {
  let defaultContexts: React.Context<unknown>[] = [];

  /* -----------------------------------------------------------------------------------------------
   * createContext
   * ---------------------------------------------------------------------------------------------*/

  function createContext<ContextValueType extends object | null>(
    rootComponentName: string,
    defaultContext?: ContextValueType,
  ) {
    const BaseContext = React.createContext<ContextValueType | undefined>(defaultContext);
    const index = defaultContexts.length;
    defaultContexts = [...defaultContexts, (defaultContext ?? null) as React.Context<unknown>];

    const Provider = (
      props: ContextValueType & {
        scope: Scope<ContextValueType>;
        children: React.ReactNode;
      },
    ) => {
      const { scope, children, ...context } = props;
      const Context = scope?.[scopeName]?.[index] || BaseContext;
      // Only re-memoize when prop values change
      // biome-ignore lint/correctness/useExhaustiveDependencies: context is intentionally used as dependency for memoization
      const value = React.useMemo(() => context, [context]) as ContextValueType;
      return <Context.Provider value={value}>{children}</Context.Provider>;
    };

    Provider.displayName = `${rootComponentName}Provider`;

    function useContextValue(consumerName: string, scope: Scope<ContextValueType | undefined>) {
      const Context = scope?.[scopeName]?.[index] || BaseContext;
      const context = React.use(Context);
      if (context) return context;
      if (defaultContext !== undefined) return defaultContext;
      // if a defaultContext wasn't specified, it's a required context.
      throw new Error(`\`${consumerName}\` must be used within \`${rootComponentName}\``);
    }

    return [Provider, useContextValue] as const;
  }

  /* -----------------------------------------------------------------------------------------------
   * createScope
   * ---------------------------------------------------------------------------------------------*/

  const createScope: CreateScope = () => {
    const scopeContexts = defaultContexts.map((defaultContext) => {
      return React.createContext(defaultContext);
    });
    return function useScope(scope: Scope) {
      const contexts = scope?.[scopeName] || scopeContexts;
      return React.useMemo(
        () => ({
          [`__scope${scopeName}`]: { ...scope, [scopeName]: contexts } as Scope,
        }),
        [scope, contexts],
      ) as { [__scopeProp: string]: Scope };
    };
  };

  createScope.scopeName = scopeName;
  return [createContext, composeContextScopes(createScope, ...createContextScopeDeps)] as const;
}

/* -------------------------------------------------------------------------------------------------
 * composeContextScopes
 * -----------------------------------------------------------------------------------------------*/

function composeContextScopes(...scopes: CreateScope[]) {
  const baseScope = scopes[0];
  if (scopes.length === 1) {
    return (
      baseScope ??
      (() => {
        // Default empty scope when no base scope is provided
        return {};
      })
    );
  }

  const createScope: CreateScope = () => {
    const scopeHooks = scopes.map((createScope) => ({
      useScope: createScope(),
      scopeName: createScope.scopeName,
    }));

    return function useComposedScopes(overrideScopes) {
      const nextScopes = scopeHooks.reduce((nextScopes, { useScope, scopeName }) => {
        // We are calling a hook inside a callback which React warns against to avoid inconsistent
        // renders, however, scoping doesn't have render side effects so we ignore the rule.
        const scopeProps = useScope(overrideScopes);
        const currentScope = scopeProps[`__scope${scopeName}`];
        // biome-ignore lint/performance/noAccumulatingSpread: Object spread needed for scope composition
        return { ...nextScopes, ...currentScope };
      }, {});

      return React.useMemo(
        () => ({ [`__scope${baseScope?.scopeName}`]: nextScopes }),
        [nextScopes],
      );
    };
  };

  createScope.scopeName = baseScope?.scopeName ?? 'defaultScope';
  return createScope;
}

/* -----------------------------------------------------------------------------------------------*/

export type { CreateScope, Scope };
export { createContext, createContextScope };
