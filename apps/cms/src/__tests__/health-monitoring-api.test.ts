/**
 * Health Monitoring API Tests
 */

import { NextRequest } from 'next/server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { GET as getProcessList } from '../app/api/health-monitoring/processes/route';
import { GET as getHealthMonitoring } from '../app/api/health-monitoring/route';

// Mock the monitoring functions
vi.mock('@revealui/core/monitoring', () => ({
  getHealthMetrics: vi.fn(() => ({
    system: {
      memoryUsage: 256,
      cpuUsage: 15.5,
      uptime: 3600,
      platform: 'linux',
      nodeVersion: 'v24.13.0',
    },
    processes: {
      active: 5,
      zombies: 0,
      failed: 1,
      spawnRate: 2,
      bySource: {
        exec: 3,
        orchestration: 1,
        mcp: 1,
        'ai-runtime': 0,
        'dev-server': 0,
        database: 0,
        unknown: 0,
      },
    },
    database: {
      rest: [
        {
          name: 'pool-1',
          totalCount: 10,
          idleCount: 7,
          waitingCount: 0,
        },
      ],
      vector: [],
    },
    recentZombies: [],
    alerts: [],
    timestamp: Date.now(),
  })),
  getHealthStatus: vi.fn((alerts) => {
    const hasCritical = alerts.some((a: { level: string }) => a.level === 'critical');
    const hasWarning = alerts.some((a: { level: string }) => a.level === 'warning');

    if (hasCritical) {
      return { status: 'unhealthy', statusCode: 503 };
    } else if (hasWarning) {
      return { status: 'degraded', statusCode: 206 };
    } else {
      return { status: 'healthy', statusCode: 200 };
    }
  }),
  sendAlerts: vi.fn(),
  getAllProcesses: vi.fn(() => [
    {
      pid: 1234,
      command: 'node',
      args: ['test.js'],
      source: 'exec',
      status: 'running',
      startTime: Date.now() - 60000,
    },
    {
      pid: 5678,
      command: 'mcp',
      args: ['server'],
      source: 'mcp',
      status: 'completed',
      startTime: Date.now() - 120000,
      endTime: Date.now() - 60000,
      exitCode: 0,
    },
  ]),
}));

vi.mock('@revealui/db/client', () => ({
  getPoolMetrics: vi.fn(() => [
    {
      name: 'pool-1',
      totalCount: 10,
      idleCount: 7,
      waitingCount: 0,
    },
  ]),
}));

const AUTH = { headers: { 'x-internal-token': 'test-secret' } };

describe('Health Monitoring API', () => {
  beforeAll(() => vi.stubEnv('REVEALUI_SECRET', 'test-secret'));
  afterAll(() => vi.unstubAllEnvs());

  describe('GET /api/health-monitoring', () => {
    it('should return health metrics with 200 status when healthy', async () => {
      const response = await getHealthMonitoring(
        new NextRequest('http://localhost/api/health-monitoring', AUTH),
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('system');
      expect(data).toHaveProperty('processes');
      expect(data).toHaveProperty('database');
      expect(data).toHaveProperty('alerts');
      expect(data).toHaveProperty('timestamp');
    });

    it('should include system metrics', async () => {
      const response = await getHealthMonitoring(
        new NextRequest('http://localhost/api/health-monitoring', AUTH),
      );
      const data = await response.json();

      expect(data.system).toHaveProperty('memoryUsage');
      expect(data.system).toHaveProperty('cpuUsage');
      expect(data.system).toHaveProperty('uptime');
      expect(data.system).toHaveProperty('platform');
      expect(data.system).toHaveProperty('nodeVersion');
    });

    it('should include process metrics', async () => {
      const response = await getHealthMonitoring(
        new NextRequest('http://localhost/api/health-monitoring', AUTH),
      );
      const data = await response.json();

      expect(data.processes).toHaveProperty('active');
      expect(data.processes).toHaveProperty('zombies');
      expect(data.processes).toHaveProperty('failed');
      expect(data.processes).toHaveProperty('spawnRate');
      expect(data.processes).toHaveProperty('bySource');
    });

    it('should include database metrics', async () => {
      const response = await getHealthMonitoring(
        new NextRequest('http://localhost/api/health-monitoring', AUTH),
      );
      const data = await response.json();

      expect(data.database).toHaveProperty('rest');
      expect(data.database).toHaveProperty('vector');
      expect(Array.isArray(data.database.rest)).toBe(true);
      expect(Array.isArray(data.database.vector)).toBe(true);
    });
  });

  describe('GET /api/health-monitoring/processes', () => {
    it('should return process list', async () => {
      const request = new NextRequest('http://localhost/api/health-monitoring/processes', AUTH);
      const response = await getProcessList(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('processes');
      expect(data).toHaveProperty('total');
      expect(data).toHaveProperty('filtered');
      expect(Array.isArray(data.processes)).toBe(true);
    });

    it('should filter processes by status', async () => {
      const request = new NextRequest(
        'http://localhost/api/health-monitoring/processes?status=running',
        AUTH,
      );
      const response = await getProcessList(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.processes.every((p: { status: string }) => p.status === 'running')).toBe(true);
    });

    it('should filter processes by source', async () => {
      const request = new NextRequest(
        'http://localhost/api/health-monitoring/processes?source=exec',
        AUTH,
      );
      const response = await getProcessList(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.processes.every((p: { source: string }) => p.source === 'exec')).toBe(true);
    });

    it('should respect limit parameter', async () => {
      const request = new NextRequest(
        'http://localhost/api/health-monitoring/processes?limit=1',
        AUTH,
      );
      const response = await getProcessList(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.processes.length).toBeLessThanOrEqual(1);
    });

    it('should sort processes by startTime descending by default', async () => {
      const request = new NextRequest('http://localhost/api/health-monitoring/processes', AUTH);
      const response = await getProcessList(request);
      const data = await response.json();

      if (data.processes.length > 1) {
        expect(data.processes[0].startTime).toBeGreaterThanOrEqual(data.processes[1].startTime);
      }
    });
  });
});
