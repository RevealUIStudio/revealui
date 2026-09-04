/**
 * Hosted non-operator namespace. One helper for write and read.
 * Agent DIDs must not be passed in.
 */
export function tenantNaturalKey(tenantId: string, clientKey: string): string {
  const prefix = `tenant:${tenantId}:`;
  if (clientKey.startsWith(prefix)) return clientKey;
  return `${prefix}${clientKey}`;
}

export function shouldNamespaceKeys(principal: {
  trustBoundary: 'studio-local' | 'hosted';
  isFleetOperator: boolean;
}): boolean {
  return principal.trustBoundary === 'hosted' && !principal.isFleetOperator;
}
