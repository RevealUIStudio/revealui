import { beforeEach, describe, expect, it } from 'vitest';
import {
  createSpanFromContext,
  createTracingMiddleware,
  extractTraceContext,
  getSpanContext,
  injectTraceContext,
  type Span,
  TracingSystem,
  trace,
  traceAPICall,
  traceCacheOperation,
  traceDBQuery,
  traceSync,
  tracing,
} from '../tracing.js';

describe('TracingSystem', () => {
  let system: TracingSystem;

  beforeEach(() => {
    system = new TracingSystem();
  });

  describe('startTrace', () => {
    it('creates a root span with generated IDs', () => {
      const span = system.startTrace('test-op');

      expect(span.traceId).toHaveLength(16);
      expect(span.spanId).toHaveLength(16);
      expect(span.parentSpanId).toBeUndefined();
      expect(span.name).toBe('test-op');
      expect(span.status).toBe('ok');
      expect(span.tags).toEqual({});
      expect(span.logs).toEqual([]);
      expect(span.startTime).toBeGreaterThan(0);
      expect(span.endTime).toBeUndefined();
      expect(span.duration).toBeUndefined();
    });

    it('creates a root span with tags', () => {
      const span = system.startTrace('tagged-op', {
        'http.method': 'GET',
        'http.status': 200,
        cached: true,
      });

      expect(span.tags).toEqual({
        'http.method': 'GET',
        'http.status': 200,
        cached: true,
      });
    });

    it('generates unique IDs for each trace', () => {
      const span1 = system.startTrace('op1');
      const span2 = system.startTrace('op2');

      expect(span1.traceId).not.toBe(span2.traceId);
      expect(span1.spanId).not.toBe(span2.spanId);
    });
  });

  describe('startSpan', () => {
    it('creates a child span inheriting the traceId', () => {
      const parent = system.startTrace('parent-op');
      const child = system.startSpan('child-op', parent);

      expect(child.traceId).toBe(parent.traceId);
      expect(child.parentSpanId).toBe(parent.spanId);
      expect(child.spanId).not.toBe(parent.spanId);
      expect(child.name).toBe('child-op');
      expect(child.status).toBe('ok');
    });

    it('creates a child span with tags', () => {
      const parent = system.startTrace('parent');
      const child = system.startSpan('child', parent, { level: 2 });

      expect(child.tags).toEqual({ level: 2 });
    });

    it('supports multi-level nesting', () => {
      const root = system.startTrace('root');
      const child = system.startSpan('child', root);
      const grandchild = system.startSpan('grandchild', child);

      expect(grandchild.traceId).toBe(root.traceId);
      expect(grandchild.parentSpanId).toBe(child.spanId);
      expect(child.parentSpanId).toBe(root.spanId);
    });
  });

  describe('endSpan', () => {
    it('sets endTime and duration on success', () => {
      const span = system.startTrace('op');
      system.endSpan(span);

      expect(span.endTime).toBeGreaterThanOrEqual(span.startTime);
      expect(span.duration).toBe(span.endTime! - span.startTime);
      expect(span.status).toBe('ok');
      expect(span.error).toBeUndefined();
    });

    it('sets error details when an error is provided', () => {
      const span = system.startTrace('failing-op');
      const err = new Error('something broke');
      err.stack = 'Error: something broke\n    at test.ts:1:1';

      system.endSpan(span, err);

      expect(span.status).toBe('error');
      expect(span.error).toEqual({
        name: 'Error',
        message: 'something broke',
        stack: 'Error: something broke\n    at test.ts:1:1',
      });
      expect(span.endTime).toBeDefined();
      expect(span.duration).toBeDefined();
    });

    it('adds the span to completed traces', () => {
      const span = system.startTrace('op');
      system.endSpan(span);

      const retrievedTrace = system.getTrace(span.traceId);
      expect(retrievedTrace).toBeDefined();
      expect(retrievedTrace!.spans).toHaveLength(1);
      expect(retrievedTrace!.spans[0]).toBe(span);
    });

    it('groups spans under the same trace', () => {
      const root = system.startTrace('root');
      const child = system.startSpan('child', root);

      system.endSpan(child);
      system.endSpan(root);

      const retrievedTrace = system.getTrace(root.traceId);
      expect(retrievedTrace).toBeDefined();
      expect(retrievedTrace!.spans).toHaveLength(2);
    });

    it('marks the root span (no parentSpanId) as rootSpan on the trace', () => {
      const root = system.startTrace('root');
      const child = system.startSpan('child', root);

      system.endSpan(child);
      system.endSpan(root);

      const retrievedTrace = system.getTrace(root.traceId);
      expect(retrievedTrace!.rootSpan).toBe(root);
    });

    it('updates trace startTime to the earliest span', () => {
      const root = system.startTrace('root');
      // Manually shift the root startTime forward to simulate out-of-order
      const originalStart = root.startTime;
      const child = system.startSpan('child', root);
      // Manually set child to start earlier
      child.startTime = originalStart - 100;

      system.endSpan(child);

      const retrievedTrace = system.getTrace(root.traceId);
      expect(retrievedTrace!.startTime).toBe(originalStart - 100);
    });

    it('updates trace endTime to the latest span endTime', () => {
      const root = system.startTrace('root');
      const child = system.startSpan('child', root);

      system.endSpan(child);
      const childEndTime = child.endTime!;

      system.endSpan(root);
      const rootEndTime = root.endTime!;

      const retrievedTrace = system.getTrace(root.traceId);
      expect(retrievedTrace!.endTime).toBe(Math.max(childEndTime, rootEndTime));
    });

    it('computes trace duration when endTime is set', () => {
      const span = system.startTrace('op');
      system.endSpan(span);

      const retrievedTrace = system.getTrace(span.traceId);
      expect(retrievedTrace!.duration).toBe(retrievedTrace!.endTime! - retrievedTrace!.startTime);
    });
  });

  describe('setTag', () => {
    it('adds a tag to a span', () => {
      const span = system.startTrace('op');
      system.setTag(span, 'http.method', 'POST');
      system.setTag(span, 'http.status', 201);
      system.setTag(span, 'cached', false);

      expect(span.tags).toEqual({
        'http.method': 'POST',
        'http.status': 201,
        cached: false,
      });
    });

    it('overwrites an existing tag', () => {
      const span = system.startTrace('op', { key: 'old' });
      system.setTag(span, 'key', 'new');

      expect(span.tags.key).toBe('new');
    });
  });

  describe('log', () => {
    it('appends a log entry to a span', () => {
      const span = system.startTrace('op');
      system.log(span, 'processing started');

      expect(span.logs).toHaveLength(1);
      expect(span.logs[0].message).toBe('processing started');
      expect(span.logs[0].timestamp).toBeGreaterThan(0);
      expect(span.logs[0].fields).toBeUndefined();
    });

    it('appends a log entry with fields', () => {
      const span = system.startTrace('op');
      system.log(span, 'query executed', { rows: 42, table: 'users' });

      expect(span.logs[0].fields).toEqual({ rows: 42, table: 'users' });
    });

    it('appends multiple log entries in order', () => {
      const span = system.startTrace('op');
      system.log(span, 'step-1');
      system.log(span, 'step-2');
      system.log(span, 'step-3');

      expect(span.logs).toHaveLength(3);
      expect(span.logs.map((l) => l.message)).toEqual(['step-1', 'step-2', 'step-3']);
    });
  });

  describe('getTrace / getAllTraces / clearTraces', () => {
    it('returns undefined for a nonexistent traceId', () => {
      expect(system.getTrace('nonexistent')).toBeUndefined();
    });

    it('getAllTraces returns all completed traces', () => {
      const s1 = system.startTrace('op1');
      const s2 = system.startTrace('op2');
      system.endSpan(s1);
      system.endSpan(s2);

      const all = system.getAllTraces();
      expect(all).toHaveLength(2);
    });

    it('clearTraces removes all traces', () => {
      const s1 = system.startTrace('op');
      system.endSpan(s1);

      expect(system.getAllTraces()).toHaveLength(1);
      system.clearTraces();
      expect(system.getAllTraces()).toHaveLength(0);
    });
  });

  describe('max traces eviction', () => {
    it('evicts the oldest trace when maxTraces is exceeded', () => {
      // maxTraces defaults to 1000. We cannot easily change it, but we can
      // create 1002 traces and verify the first two are evicted.
      // For efficiency, we only verify the eviction logic path.
      const firstSpan = system.startTrace('first');
      system.endSpan(firstSpan);
      const firstTraceId = firstSpan.traceId;

      // Fill to capacity
      for (let i = 0; i < 1000; i++) {
        const s = system.startTrace(`op-${i}`);
        system.endSpan(s);
      }

      // The first trace should have been evicted
      expect(system.getTrace(firstTraceId)).toBeUndefined();
    });
  });

  describe('exportJaeger', () => {
    it('exports traces in Jaeger format with microsecond timestamps', () => {
      const span = system.startTrace('http.request', { 'http.method': 'GET' });
      system.log(span, 'handler called', { handler: 'index' });
      system.endSpan(span);

      const exported = system.exportJaeger();
      expect(exported).toHaveLength(1);

      const jaegerTrace = exported[0] as Record<string, unknown>;
      expect(jaegerTrace.traceID).toBe(span.traceId);

      const jaegerSpans = jaegerTrace.spans as Array<Record<string, unknown>>;
      expect(jaegerSpans).toHaveLength(1);

      const js = jaegerSpans[0];
      expect(js.traceID).toBe(span.traceId);
      expect(js.spanID).toBe(span.spanId);
      expect(js.operationName).toBe('http.request');
      expect(js.startTime).toBe(span.startTime * 1000);
      expect(js.duration).toBe(span.duration! * 1000);

      const tags = js.tags as Array<{ key: string; type: string; value: unknown }>;
      expect(tags).toEqual([{ key: 'http.method', type: 'string', value: 'GET' }]);

      const logs = js.logs as Array<{
        timestamp: number;
        fields: Array<{ key: string; type: string; value: unknown }>;
      }>;
      expect(logs).toHaveLength(1);
      expect(logs[0].timestamp).toBe(span.logs[0].timestamp * 1000);
      expect(logs[0].fields[0]).toEqual({
        key: 'message',
        type: 'string',
        value: 'handler called',
      });
      expect(logs[0].fields[1]).toEqual({
        key: 'handler',
        type: 'string',
        value: 'index',
      });
    });

    it('exports span without duration as 0', () => {
      const span = system.startTrace('no-end');
      // Manually add to trace by ending but remove duration
      system.endSpan(span);
      span.duration = undefined;

      const exported = system.exportJaeger();
      const jaegerSpan = (exported[0] as Record<string, unknown>).spans as Array<
        Record<string, unknown>
      >;
      expect(jaegerSpan[0].duration).toBe(0);
    });

    it('exports parent-child relationship', () => {
      const root = system.startTrace('root');
      const child = system.startSpan('child', root);
      system.endSpan(child);
      system.endSpan(root);

      const exported = system.exportJaeger();
      expect(exported).toHaveLength(1);

      const spans = (exported[0] as Record<string, unknown>).spans as Array<
        Record<string, unknown>
      >;
      expect(spans).toHaveLength(2);

      const childJaeger = spans.find((s) => s.operationName === 'child');
      expect(childJaeger!.parentSpanID).toBe(root.spanId);
    });

    it('exports logs without extra fields correctly', () => {
      const span = system.startTrace('op');
      system.log(span, 'simple log');
      system.endSpan(span);

      const exported = system.exportJaeger();
      const spans = (exported[0] as Record<string, unknown>).spans as Array<
        Record<string, unknown>
      >;
      const logs = spans[0].logs as Array<{
        timestamp: number;
        fields: Array<{ key: string; type: string; value: unknown }>;
      }>;

      // Only the message field, no extra fields
      expect(logs[0].fields).toHaveLength(1);
      expect(logs[0].fields[0].key).toBe('message');
    });
  });
});

describe('trace (async)', () => {
  beforeEach(() => {
    tracing.clearTraces();
  });

  it('wraps an async function with a new trace', async () => {
    const result = await trace('async-op', async (span) => {
      expect(span.name).toBe('async-op');
      expect(span.parentSpanId).toBeUndefined();
      return 42;
    });

    expect(result).toBe(42);
    const traces = tracing.getAllTraces();
    expect(traces).toHaveLength(1);
    expect(traces[0].spans[0].status).toBe('ok');
    expect(traces[0].spans[0].endTime).toBeDefined();
  });

  it('wraps an async function with a parent span', async () => {
    const parent = tracing.startTrace('parent');

    const result = await trace(
      'child-op',
      async (span) => {
        expect(span.parentSpanId).toBe(parent.spanId);
        expect(span.traceId).toBe(parent.traceId);
        return 'done';
      },
      parent,
    );

    expect(result).toBe('done');
  });

  it('records error and re-throws on async failure', async () => {
    const err = new Error('async boom');

    await expect(
      trace('failing', async () => {
        throw err;
      }),
    ).rejects.toThrow('async boom');

    const traces = tracing.getAllTraces();
    expect(traces).toHaveLength(1);
    expect(traces[0].spans[0].status).toBe('error');
    expect(traces[0].spans[0].error!.message).toBe('async boom');
  });

  it('handles non-Error thrown values', async () => {
    await expect(
      trace('non-error', async () => {
        throw 'string-error';
      }),
    ).rejects.toBe('string-error');

    const traces = tracing.getAllTraces();
    expect(traces[0].spans[0].error!.message).toBe('string-error');
  });
});

describe('traceSync', () => {
  beforeEach(() => {
    tracing.clearTraces();
  });

  it('wraps a sync function with a new trace', () => {
    const result = traceSync('sync-op', (span) => {
      expect(span.name).toBe('sync-op');
      return 'hello';
    });

    expect(result).toBe('hello');
    const traces = tracing.getAllTraces();
    expect(traces).toHaveLength(1);
    expect(traces[0].spans[0].status).toBe('ok');
  });

  it('wraps a sync function with a parent span', () => {
    const parent = tracing.startTrace('parent');

    traceSync(
      'child',
      (span) => {
        expect(span.parentSpanId).toBe(parent.spanId);
        expect(span.traceId).toBe(parent.traceId);
      },
      parent,
    );
  });

  it('records error and re-throws on sync failure', () => {
    expect(() =>
      traceSync('failing', () => {
        throw new Error('sync boom');
      }),
    ).toThrow('sync boom');

    const traces = tracing.getAllTraces();
    expect(traces[0].spans[0].status).toBe('error');
    expect(traces[0].spans[0].error!.message).toBe('sync boom');
  });

  it('handles non-Error thrown values', () => {
    expect(() =>
      traceSync('non-error', () => {
        throw 42;
      }),
    ).toThrow();

    const traces = tracing.getAllTraces();
    expect(traces[0].spans[0].error!.message).toBe('42');
  });
});

describe('extractTraceContext', () => {
  it('parses W3C traceparent header from Headers object', () => {
    const headers = new Headers();
    headers.set('traceparent', '00-abcdef1234567890-1234567890abcdef-01');

    const ctx = extractTraceContext(headers);
    expect(ctx.traceId).toBe('abcdef1234567890');
    expect(ctx.spanId).toBe('1234567890abcdef');
  });

  it('parses W3C traceparent from plain object', () => {
    const headers = {
      traceparent: '00-traceAAAAAAAAAAAA-spanBBBBBBBBBBBBB-01',
    };

    const ctx = extractTraceContext(headers);
    expect(ctx.traceId).toBe('traceAAAAAAAAAAAA');
    expect(ctx.spanId).toBe('spanBBBBBBBBBBBBB');
  });

  it('parses B3 headers when traceparent is absent', () => {
    const headers = {
      'x-b3-traceid': 'b3trace123',
      'x-b3-spanid': 'b3span456',
    };

    const ctx = extractTraceContext(headers);
    expect(ctx.traceId).toBe('b3trace123');
    expect(ctx.spanId).toBe('b3span456');
  });

  it('handles B3 traceId without spanId', () => {
    const headers = { 'x-b3-traceid': 'b3only' };

    const ctx = extractTraceContext(headers);
    expect(ctx.traceId).toBe('b3only');
    expect(ctx.spanId).toBeUndefined();
  });

  it('prefers W3C traceparent over B3 when both present', () => {
    const headers = {
      traceparent: '00-w3ctrace-w3cspan-01',
      'x-b3-traceid': 'b3trace',
      'x-b3-spanid': 'b3span',
    };

    const ctx = extractTraceContext(headers);
    expect(ctx.traceId).toBe('w3ctrace');
    expect(ctx.spanId).toBe('w3cspan');
  });

  it('returns empty object when no trace headers exist', () => {
    const ctx = extractTraceContext({});
    expect(ctx).toEqual({});
  });

  it('returns empty object for malformed traceparent (too few parts)', () => {
    const headers = { traceparent: '00-onlyonepart' };
    const ctx = extractTraceContext(headers);
    expect(ctx).toEqual({});
  });
});

describe('injectTraceContext', () => {
  it('injects W3C and B3 headers into a Headers object', () => {
    const span: Span = {
      traceId: 'aaaa111122223333',
      spanId: 'bbbb444455556666',
      name: 'op',
      startTime: Date.now(),
      tags: {},
      logs: [],
      status: 'ok',
    };

    const headers = new Headers();
    injectTraceContext(span, headers);

    expect(headers.get('traceparent')).toBe('00-aaaa111122223333-bbbb444455556666-01');
    expect(headers.get('x-b3-traceid')).toBe('aaaa111122223333');
    expect(headers.get('x-b3-spanid')).toBe('bbbb444455556666');
    expect(headers.get('x-b3-parentspanid')).toBeNull();
  });

  it('injects parentSpanId when present', () => {
    const span: Span = {
      traceId: 'trace1',
      spanId: 'span2',
      parentSpanId: 'parent1',
      name: 'child',
      startTime: Date.now(),
      tags: {},
      logs: [],
      status: 'ok',
    };

    const headers = new Headers();
    injectTraceContext(span, headers);

    expect(headers.get('x-b3-parentspanid')).toBe('parent1');
  });

  it('injects into a plain object', () => {
    const span: Span = {
      traceId: 'trace1',
      spanId: 'span2',
      name: 'op',
      startTime: Date.now(),
      tags: {},
      logs: [],
      status: 'ok',
    };

    const headers: Record<string, string> = {};
    injectTraceContext(span, headers);

    expect(headers.traceparent).toBe('00-trace1-span2-01');
    expect(headers['x-b3-traceid']).toBe('trace1');
    expect(headers['x-b3-spanid']).toBe('span2');
  });
});

describe('createTracingMiddleware', () => {
  beforeEach(() => {
    tracing.clearTraces();
  });

  it('creates a new trace when no trace headers are present', async () => {
    const middleware = createTracingMiddleware();
    const request = {
      url: 'http://localhost:3000/api/users',
      method: 'GET',
      headers: {},
    };

    const response = await middleware(request, async () => ({
      status: 200,
      headers: {} as Record<string, string>,
    }));

    expect(response.status).toBe(200);
    const traces = tracing.getAllTraces();
    expect(traces).toHaveLength(1);
    expect(traces[0].spans[0].name).toBe('GET /api/users');
    expect(traces[0].spans[0].tags['http.method']).toBe('GET');
    expect(traces[0].spans[0].tags['http.url']).toBe('http://localhost:3000/api/users');
    expect(traces[0].spans[0].tags['http.path']).toBe('/api/users');
    expect(traces[0].spans[0].tags['http.status_code']).toBe(200);
  });

  it('continues an existing trace when traceparent header is present', async () => {
    const middleware = createTracingMiddleware();
    const request = {
      url: 'http://localhost:3000/api/data',
      method: 'POST',
      headers: {
        traceparent: '00-existingtraceid1-existingspanid22-01',
      },
    };

    await middleware(request, async () => ({
      status: 201,
      headers: {} as Record<string, string>,
    }));

    const traces = tracing.getAllTraces();
    expect(traces).toHaveLength(1);
    const span = traces[0].spans[0];
    expect(span.traceId).toBe('existingtraceid1');
    expect(span.parentSpanId).toBe('existingspanid22');
  });

  it('marks span as error for status >= 400', async () => {
    const middleware = createTracingMiddleware();
    const request = {
      url: 'http://localhost:3000/not-found',
      method: 'GET',
      headers: {},
    };

    await middleware(request, async () => ({
      status: 404,
      headers: {} as Record<string, string>,
    }));

    const traces = tracing.getAllTraces();
    expect(traces[0].spans[0].status).toBe('error');
    expect(traces[0].spans[0].tags['http.status_code']).toBe(404);
  });

  it('defaults to status 200 when response has no status', async () => {
    const middleware = createTracingMiddleware();
    const request = {
      url: 'http://localhost:3000/api/health',
      method: 'GET',
      headers: {},
    };

    await middleware(request, async () => ({
      headers: {} as Record<string, string>,
    }));

    const traces = tracing.getAllTraces();
    expect(traces[0].spans[0].tags['http.status_code']).toBe(200);
    expect(traces[0].spans[0].status).toBe('ok');
  });

  it('injects trace context into response headers', async () => {
    const middleware = createTracingMiddleware();
    const request = {
      url: 'http://localhost:3000/api/test',
      method: 'GET',
      headers: {},
    };

    const responseHeaders: Record<string, string> = {};
    await middleware(request, async () => ({
      status: 200,
      headers: responseHeaders,
    }));

    expect(responseHeaders.traceparent).toBeDefined();
    expect(responseHeaders['x-b3-traceid']).toBeDefined();
  });

  it('handles exceptions thrown by the next handler', async () => {
    const middleware = createTracingMiddleware();
    const request = {
      url: 'http://localhost:3000/api/crash',
      method: 'GET',
      headers: {},
    };

    await expect(
      middleware(request, async () => {
        throw new Error('handler crash');
      }),
    ).rejects.toThrow('handler crash');

    const traces = tracing.getAllTraces();
    expect(traces[0].spans[0].status).toBe('error');
    expect(traces[0].spans[0].tags['http.status_code']).toBe(500);
    expect(traces[0].spans[0].error!.message).toBe('handler crash');
  });

  it('handles missing request headers gracefully', async () => {
    const middleware = createTracingMiddleware();
    const request = {
      url: 'http://localhost:3000/api/no-headers',
      method: 'GET',
    };

    const response = await middleware(request, async () => ({
      status: 200,
      headers: {} as Record<string, string>,
    }));

    expect(response.status).toBe(200);
  });

  it('does not inject trace context when response has no headers', async () => {
    const middleware = createTracingMiddleware();
    const request = {
      url: 'http://localhost:3000/api/no-resp-headers',
      method: 'GET',
      headers: {},
    };

    // This should not throw even though response.headers is undefined
    const response = await middleware(request, async () => ({
      status: 200,
    }));

    expect(response.status).toBe(200);
  });
});

describe('traceDBQuery', () => {
  beforeEach(() => {
    tracing.clearTraces();
  });

  it('traces a database query with statement tag', async () => {
    const result = await traceDBQuery('SELECT * FROM users', async () => [{ id: 1 }]);

    expect(result).toEqual([{ id: 1 }]);
    const traces = tracing.getAllTraces();
    expect(traces).toHaveLength(1);
    expect(traces[0].spans[0].name).toBe('database.query');
    expect(traces[0].spans[0].tags['db.statement']).toBe('SELECT * FROM users');
    expect(traces[0].spans[0].tags['db.type']).toBe('sql');
  });

  it('accepts a parent span', async () => {
    const parent = tracing.startTrace('http.request');

    await traceDBQuery('INSERT INTO logs VALUES (?)', async () => undefined, parent);

    const traces = tracing.getAllTraces();
    const dbSpan = traces[0].spans.find((s) => s.name === 'database.query');
    expect(dbSpan!.parentSpanId).toBe(parent.spanId);
  });
});

describe('traceAPICall', () => {
  beforeEach(() => {
    tracing.clearTraces();
  });

  it('traces an API call with method and url tags', async () => {
    const result = await traceAPICall('GET', 'https://api.example.com/data', async () => ({
      data: 'ok',
    }));

    expect(result).toEqual({ data: 'ok' });
    const traces = tracing.getAllTraces();
    expect(traces[0].spans[0].name).toBe('api.call');
    expect(traces[0].spans[0].tags['http.method']).toBe('GET');
    expect(traces[0].spans[0].tags['http.url']).toBe('https://api.example.com/data');
  });

  it('accepts a parent span', async () => {
    const parent = tracing.startTrace('handler');

    await traceAPICall('POST', 'https://api.example.com/webhook', async () => 'sent', parent);

    const traces = tracing.getAllTraces();
    const apiSpan = traces[0].spans.find((s) => s.name === 'api.call');
    expect(apiSpan!.parentSpanId).toBe(parent.spanId);
  });
});

describe('traceCacheOperation', () => {
  beforeEach(() => {
    tracing.clearTraces();
  });

  it('traces a cache operation with operation and key tags', async () => {
    const result = await traceCacheOperation('get', 'user:123', async () => ({
      name: 'Alice',
    }));

    expect(result).toEqual({ name: 'Alice' });
    const traces = tracing.getAllTraces();
    expect(traces[0].spans[0].name).toBe('cache.operation');
    expect(traces[0].spans[0].tags['cache.operation']).toBe('get');
    expect(traces[0].spans[0].tags['cache.key']).toBe('user:123');
  });

  it('accepts a parent span', async () => {
    const parent = tracing.startTrace('handler');

    await traceCacheOperation('set', 'session:abc', async () => true, parent);

    const traces = tracing.getAllTraces();
    const cacheSpan = traces[0].spans.find((s) => s.name === 'cache.operation');
    expect(cacheSpan!.parentSpanId).toBe(parent.spanId);
  });
});

describe('getSpanContext', () => {
  it('extracts traceId, spanId, and parentSpanId from a span', () => {
    const span: Span = {
      traceId: 'trace-abc',
      spanId: 'span-def',
      parentSpanId: 'parent-ghi',
      name: 'op',
      startTime: Date.now(),
      tags: {},
      logs: [],
      status: 'ok',
    };

    const ctx = getSpanContext(span);
    expect(ctx).toEqual({
      traceId: 'trace-abc',
      spanId: 'span-def',
      parentSpanId: 'parent-ghi',
    });
  });

  it('omits parentSpanId when not present', () => {
    const span: Span = {
      traceId: 'trace-abc',
      spanId: 'span-def',
      name: 'root',
      startTime: Date.now(),
      tags: {},
      logs: [],
      status: 'ok',
    };

    const ctx = getSpanContext(span);
    expect(ctx.parentSpanId).toBeUndefined();
  });
});

describe('createSpanFromContext', () => {
  beforeEach(() => {
    tracing.clearTraces();
  });

  it('creates a child span from a context object', () => {
    const context = {
      traceId: 'remote-trace-id',
      spanId: 'remote-span-id',
    };

    const span = createSpanFromContext('local-op', context);

    expect(span.traceId).toBe('remote-trace-id');
    // parentSpanId should be set to context.spanId (since parentSpanId is absent)
    expect(span.parentSpanId).toBe('remote-span-id');
    expect(span.name).toBe('local-op');
  });

  it('uses parentSpanId from context when available', () => {
    const context = {
      traceId: 'remote-trace-id',
      spanId: 'remote-span-id',
      parentSpanId: 'remote-parent-id',
    };

    const span = createSpanFromContext('local-op', context);

    // The synthetic parent span uses context.parentSpanId as its spanId
    expect(span.parentSpanId).toBe('remote-parent-id');
  });

  it('applies tags to the created span', () => {
    const context = { traceId: 'tid', spanId: 'sid' };
    const span = createSpanFromContext('tagged-op', context, { env: 'test' });

    expect(span.tags.env).toBe('test');
  });
});

describe('default tracing singleton', () => {
  it('is an instance of TracingSystem', () => {
    expect(tracing).toBeInstanceOf(TracingSystem);
  });
});
