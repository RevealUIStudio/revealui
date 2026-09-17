import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExecutionLogger } from '../audit/execution-logger.js';

describe('ExecutionLogger.getStats', () => {
  const query = vi.fn();

  beforeEach(() => {
    query.mockReset();
    query.mockResolvedValue({
      rows: [
        {
          total: 0,
          successful: 0,
          failed: 0,
          avg_duration: 0,
        },
      ],
    });
  });

  function loggerWithMock(): ExecutionLogger {
    const logger = Object.create(ExecutionLogger.prototype) as ExecutionLogger;
    Object.assign(logger, { db: { query } });
    return logger;
  }

  it('binds scriptName and days as query params, not SQL text', async () => {
    const logger = loggerWithMock();
    await logger.getStats({ scriptName: "x'; DROP TABLE executions; --", days: 7 });

    expect(query).toHaveBeenCalled();
    for (const [sql, params] of query.mock.calls) {
      expect(String(sql)).not.toContain('DROP TABLE');
      expect(String(sql)).not.toContain("x'");
      expect(params).toEqual(expect.arrayContaining([7, "x'; DROP TABLE executions; --"]));
    }
  });
});
