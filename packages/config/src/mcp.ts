export type McpMetricsMode = 'logs' | 'otel' | 'prometheus';

export interface McpConfig {
  persistenceDriver: 'pglite' | 'postgres';
  electricDatabaseUrl: string | null;
  electricApiKey: string | null;
  metricsMode: McpMetricsMode;
  pgvectorEnabled: boolean;
}

function boolFromEnv(v: string | undefined, fallback = false) {
  if (v === undefined) return fallback;
  return ['1', 'true', 'yes'].includes(v.toLowerCase());
}

export function getMcpConfig(): McpConfig {
  const persistenceDriver =
    (process.env.MCP_PERSISTENCE_DRIVER as 'pglite' | 'postgres') || 'pglite';
  const metricsMode = (process.env.MCP_METRICS_MODE as McpMetricsMode) || 'logs';

  return {
    persistenceDriver,
    electricDatabaseUrl: process.env.ELECTRIC_DATABASE_URL || null,
    electricApiKey: process.env.ELECTRIC_API_KEY || null,
    metricsMode,
    pgvectorEnabled: boolFromEnv(process.env.PGVECTOR_ENABLED, false),
  };
}

export default getMcpConfig;
