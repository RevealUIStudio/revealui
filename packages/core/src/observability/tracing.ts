/**
 * Distributed Tracing System
 *
 * Implements distributed tracing for tracking requests across services
 */

export interface Span {
  traceId: string
  spanId: string
  parentSpanId?: string
  name: string
  startTime: number
  endTime?: number
  duration?: number
  tags: Record<string, string | number | boolean>
  logs: Array<{
    timestamp: number
    message: string
    fields?: Record<string, unknown>
  }>
  status: 'ok' | 'error'
  error?: {
    name: string
    message: string
    stack?: string
  }
}

export interface Trace {
  traceId: string
  spans: Span[]
  startTime: number
  endTime?: number
  duration?: number
  rootSpan?: Span
}

export class TracingSystem {
  private activeSpans: Map<string, Span> = new Map()
  private completedTraces: Map<string, Trace> = new Map()
  private maxTraces: number = 1000

  /**
   * Start a new trace
   */
  startTrace(name: string, tags?: Record<string, string | number | boolean>): Span {
    const traceId = this.generateId()
    const spanId = this.generateId()

    const span: Span = {
      traceId,
      spanId,
      name,
      startTime: Date.now(),
      tags: tags || {},
      logs: [],
      status: 'ok',
    }

    this.activeSpans.set(spanId, span)

    return span
  }

  /**
   * Start a child span
   */
  startSpan(
    name: string,
    parentSpan: Span,
    tags?: Record<string, string | number | boolean>,
  ): Span {
    const spanId = this.generateId()

    const span: Span = {
      traceId: parentSpan.traceId,
      spanId,
      parentSpanId: parentSpan.spanId,
      name,
      startTime: Date.now(),
      tags: tags || {},
      logs: [],
      status: 'ok',
    }

    this.activeSpans.set(spanId, span)

    return span
  }

  /**
   * End a span
   */
  endSpan(span: Span, error?: Error): void {
    span.endTime = Date.now()
    span.duration = span.endTime - span.startTime

    if (error) {
      span.status = 'error'
      span.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      }
    }

    this.activeSpans.delete(span.spanId)

    // Add to completed traces
    this.addToTrace(span)
  }

  /**
   * Add tag to span
   */
  setTag(span: Span, key: string, value: string | number | boolean): void {
    span.tags[key] = value
  }

  /**
   * Log event in span
   */
  log(span: Span, message: string, fields?: Record<string, unknown>): void {
    span.logs.push({
      timestamp: Date.now(),
      message,
      fields,
    })
  }

  /**
   * Add span to trace
   */
  private addToTrace(span: Span): void {
    let trace = this.completedTraces.get(span.traceId)

    if (!trace) {
      trace = {
        traceId: span.traceId,
        spans: [],
        startTime: span.startTime,
      }

      this.completedTraces.set(span.traceId, trace)

      // Cleanup old traces
      if (this.completedTraces.size > this.maxTraces) {
        const oldestTraceId = this.completedTraces.keys().next().value
        if (oldestTraceId !== undefined) {
          this.completedTraces.delete(oldestTraceId)
        }
      }
    }

    trace.spans.push(span)

    // Update trace times
    if (span.endTime && (!trace.endTime || span.endTime > trace.endTime)) {
      trace.endTime = span.endTime
    }

    if (span.startTime < trace.startTime) {
      trace.startTime = span.startTime
    }

    if (trace.endTime) {
      trace.duration = trace.endTime - trace.startTime
    }

    // Find root span
    if (!span.parentSpanId) {
      trace.rootSpan = span
    }
  }

  /**
   * Get trace by ID
   */
  getTrace(traceId: string): Trace | undefined {
    return this.completedTraces.get(traceId)
  }

  /**
   * Get all traces
   */
  getAllTraces(): Trace[] {
    return Array.from(this.completedTraces.values())
  }

  /**
   * Clear all traces
   */
  clearTraces(): void {
    this.completedTraces.clear()
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return crypto.randomUUID().replace(/-/g, '').substring(0, 16)
  }

  /**
   * Export traces in Jaeger format
   */
  exportJaeger(): unknown[] {
    return this.getAllTraces().map((trace) => ({
      traceID: trace.traceId,
      spans: trace.spans.map((span) => ({
        traceID: span.traceId,
        spanID: span.spanId,
        parentSpanID: span.parentSpanId,
        operationName: span.name,
        startTime: span.startTime * 1000, // microseconds
        duration: span.duration ? span.duration * 1000 : 0,
        tags: Object.entries(span.tags).map(([key, value]) => ({
          key,
          type: typeof value,
          value,
        })),
        logs: span.logs.map((log) => ({
          timestamp: log.timestamp * 1000,
          fields: [
            {
              key: 'message',
              type: 'string',
              value: log.message,
            },
            ...(log.fields
              ? Object.entries(log.fields).map(([key, value]) => ({
                  key,
                  type: typeof value,
                  value,
                }))
              : []),
          ],
        })),
      })),
    }))
  }
}

/**
 * Default tracing system
 */
export const tracing = new TracingSystem()

/**
 * Trace a function
 */
export async function trace<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  parentSpan?: Span,
): Promise<T> {
  const span = parentSpan
    ? tracing.startSpan(name, parentSpan)
    : tracing.startTrace(name)

  try {
    const result = await fn(span)
    tracing.endSpan(span)
    return result
  } catch (error) {
    tracing.endSpan(span, error instanceof Error ? error : new Error(String(error)))
    throw error
  }
}

/**
 * Trace synchronous function
 */
export function traceSync<T>(
  name: string,
  fn: (span: Span) => T,
  parentSpan?: Span,
): T {
  const span = parentSpan
    ? tracing.startSpan(name, parentSpan)
    : tracing.startTrace(name)

  try {
    const result = fn(span)
    tracing.endSpan(span)
    return result
  } catch (error) {
    tracing.endSpan(span, error instanceof Error ? error : new Error(String(error)))
    throw error
  }
}

/**
 * Extract trace context from headers
 */
export function extractTraceContext(headers: Headers | Record<string, string>): {
  traceId?: string
  spanId?: string
} {
  // Handle both Headers and Record<string, string>
  const getHeader = (key: string): string | null | undefined => {
    if ('get' in headers && typeof headers.get === 'function') {
      return headers.get(key)
    }
    return (headers as Record<string, string>)[key]
  }

  // Support multiple formats
  const traceParent = getHeader('traceparent') // W3C Trace Context
  const b3TraceId = getHeader('x-b3-traceid') // B3 format
  const b3SpanId = getHeader('x-b3-spanid')

  if (traceParent) {
    // Parse W3C traceparent: version-traceid-spanid-flags
    const parts = traceParent.split('-')
    if (parts.length >= 3) {
      return {
        traceId: parts[1],
        spanId: parts[2],
      }
    }
  }

  if (b3TraceId) {
    return {
      traceId: b3TraceId,
      spanId: b3SpanId || undefined,
    }
  }

  return {}
}

/**
 * Inject trace context into headers
 */
export function injectTraceContext(span: Span, headers: Headers | Record<string, string>): void {
  // Handle both Headers and Record<string, string>
  const setHeader = (key: string, value: string): void => {
    if ('set' in headers && typeof headers.set === 'function') {
      headers.set(key, value)
    } else {
      (headers as Record<string, string>)[key] = value
    }
  }

  // W3C Trace Context format
  const traceparent = `00-${span.traceId}-${span.spanId}-01`
  setHeader('traceparent', traceparent)

  // B3 format (for compatibility)
  setHeader('x-b3-traceid', span.traceId)
  setHeader('x-b3-spanid', span.spanId)

  if (span.parentSpanId) {
    setHeader('x-b3-parentspanid', span.parentSpanId)
  }
}

/**
 * Create tracing middleware
 */
export function createTracingMiddleware<TRequest = unknown, TResponse = unknown>() {
  return async (
    request: TRequest & { headers?: Record<string, string>; url: string; method: string },
    next: () => Promise<TResponse & { status?: number; headers?: Record<string, string> }>,
  ): Promise<TResponse & { status?: number; headers?: Record<string, string> }> => {
    const traceContext = extractTraceContext(request.headers ?? {})
    const url = new URL(request.url)

    let span: Span

    if (traceContext.traceId) {
      // Continue existing trace
      const parentSpan: Span = {
        traceId: traceContext.traceId,
        spanId: traceContext.spanId || '',
        name: 'parent',
        startTime: Date.now(),
        tags: {},
        logs: [],
        status: 'ok',
      }

      span = tracing.startSpan(`${request.method} ${url.pathname}`, parentSpan, {
        'http.method': request.method,
        'http.url': request.url,
        'http.path': url.pathname,
      })
    } else {
      // Start new trace
      span = tracing.startTrace(`${request.method} ${url.pathname}`, {
        'http.method': request.method,
        'http.url': request.url,
        'http.path': url.pathname,
      })
    }

    try {
      const response = await next()

      const statusCode = response.status ?? 200
      tracing.setTag(span, 'http.status_code', statusCode)

      if (statusCode >= 400) {
        span.status = 'error'
      }

      tracing.endSpan(span)

      // Inject trace context into response
      if (response.headers) {
        injectTraceContext(span, response.headers)
      }

      return response
    } catch (error) {
      tracing.setTag(span, 'http.status_code', 500)
      tracing.endSpan(span, error instanceof Error ? error : new Error(String(error)))

      throw error
    }
  }
}

/**
 * Trace database query
 */
export async function traceDBQuery<T>(
  query: string,
  fn: () => Promise<T>,
  parentSpan?: Span,
): Promise<T> {
  return trace(
    'database.query',
    async (span) => {
      tracing.setTag(span, 'db.statement', query)
      tracing.setTag(span, 'db.type', 'sql')

      const result = await fn()

      return result
    },
    parentSpan,
  )
}

/**
 * Trace API call
 */
export async function traceAPICall<T>(
  method: string,
  url: string,
  fn: () => Promise<T>,
  parentSpan?: Span,
): Promise<T> {
  return trace(
    'api.call',
    async (span) => {
      tracing.setTag(span, 'http.method', method)
      tracing.setTag(span, 'http.url', url)

      const result = await fn()

      return result
    },
    parentSpan,
  )
}

/**
 * Trace cache operation
 */
export async function traceCacheOperation<T>(
  operation: string,
  key: string,
  fn: () => Promise<T>,
  parentSpan?: Span,
): Promise<T> {
  return trace(
    'cache.operation',
    async (span) => {
      tracing.setTag(span, 'cache.operation', operation)
      tracing.setTag(span, 'cache.key', key)

      const result = await fn()

      return result
    },
    parentSpan,
  )
}

/**
 * Get span context for propagation
 */
export function getSpanContext(span: Span): {
  traceId: string
  spanId: string
  parentSpanId?: string
} {
  return {
    traceId: span.traceId,
    spanId: span.spanId,
    parentSpanId: span.parentSpanId,
  }
}

/**
 * Create span from context
 */
export function createSpanFromContext(
  name: string,
  context: { traceId: string; spanId: string; parentSpanId?: string },
  tags?: Record<string, string | number | boolean>,
): Span {
  const parentSpan: Span = {
    traceId: context.traceId,
    spanId: context.parentSpanId || context.spanId,
    name: 'parent',
    startTime: Date.now(),
    tags: {},
    logs: [],
    status: 'ok',
  }

  return tracing.startSpan(name, parentSpan, tags)
}
