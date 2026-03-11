/**
 * Usage Analytics
 *
 * Analyzes script usage patterns, trends, and statistics from execution logs.
 * Provides insights into script adoption, performance, and reliability.
 *
 * @dependencies
 * - scripts/lib/audit/execution-logger.ts - Execution record retrieval
 * - @electric-sql/pglite - Embedded PostgreSQL for analytics queries
 * - node:path - Path manipulation utilities
 */

import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { type ExecutionRecord, getExecutionLogger } from '../audit/execution-logger.js';

/**
 * Script usage statistics
 */
export interface ScriptUsageStats {
  scriptName: string;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  successRate: number;
  averageDuration: number;
  totalDuration: number;
  lastExecution: Date | null;
  mostCommonCommand: string | null;
  uniqueUsers: number;
  executionsPerDay: number;
}

/**
 * Trend analysis data point
 */
export interface TrendDataPoint {
  date: string;
  value: number;
}

/**
 * Trend analysis result
 */
export interface TrendAnalysis {
  current: number;
  previous: number;
  changePercent: number;
  trend: 'improving' | 'stable' | 'degrading';
  dataPoints: TrendDataPoint[];
}

/**
 * Activity pattern by hour
 */
export interface ActivityByHour {
  hour: number;
  count: number;
}

/**
 * Activity pattern by day of week
 */
export interface ActivityByDay {
  day: string;
  dayOfWeek: number;
  count: number;
}

/**
 * Analytics dashboard data
 */
export interface AnalyticsDashboard {
  period: {
    startDate: Date;
    endDate: Date;
    days: number;
  };
  overall: {
    totalExecutions: number;
    totalScripts: number;
    totalDuration: number;
    averageSuccessRate: number;
    averageDuration: number;
  };
  mostUsedScripts: ScriptUsageStats[];
  mostFailingScripts: ScriptUsageStats[];
  fastestScripts: ScriptUsageStats[];
  slowestScripts: ScriptUsageStats[];
  executionTrend: TrendAnalysis;
  performanceTrend: TrendAnalysis;
  successRateTrend: TrendAnalysis;
}

/**
 * Dashboard query options
 */
export interface DashboardOptions {
  days?: number;
  minExecutions?: number;
}

/**
 * Usage Analytics class for script usage insights
 */
export class UsageAnalytics {
  constructor(
    _db: PGlite,
    private projectRoot: string,
  ) {}

  async initialize(): Promise<void> {
    // No additional tables needed - uses execution logger data
  }

  /**
   * Get comprehensive analytics dashboard
   */
  async getDashboard(options: DashboardOptions = {}): Promise<AnalyticsDashboard> {
    const days = options.days || 30;
    const minExecutions = options.minExecutions || 5;

    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

    const logger = await getExecutionLogger(this.projectRoot);

    // Get all executions in period
    const history = await logger.getHistory({
      startDate,
      endDate,
      limit: 100000,
    });

    // Calculate script statistics
    const scriptStats = this.calculateScriptStats(history, days);

    // Filter by minimum executions
    const filteredStats = scriptStats.filter((stat) => stat.totalExecutions >= minExecutions);

    // Sort for rankings
    const mostUsed = [...filteredStats]
      .sort((a, b) => b.totalExecutions - a.totalExecutions)
      .slice(0, 10);

    const mostFailing = [...filteredStats]
      .filter((s) => s.successRate < 100)
      .sort((a, b) => a.successRate - b.successRate)
      .slice(0, 10);

    const fastest = [...filteredStats]
      .sort((a, b) => a.averageDuration - b.averageDuration)
      .slice(0, 5);

    const slowest = [...filteredStats]
      .sort((a, b) => b.averageDuration - a.averageDuration)
      .slice(0, 5);

    // Calculate trends
    const executionTrend = this.calculateExecutionTrend(history, days);
    const performanceTrend = this.calculatePerformanceTrend(history, days);
    const successRateTrend = this.calculateSuccessRateTrend(history, days);

    // Calculate overall statistics
    const totalExecutions = history.length;
    const totalScripts = new Set(history.map((h) => h.scriptName)).size;
    const totalDuration = history.reduce((sum, h) => sum + (h.durationMs || 0), 0);
    const successfulExecutions = history.filter((h) => h.success === true).length;
    const averageSuccessRate =
      totalExecutions > 0 ? (successfulExecutions / totalExecutions) * 100 : 0;
    const averageDuration = totalExecutions > 0 ? totalDuration / totalExecutions : 0;

    return {
      period: {
        startDate,
        endDate,
        days,
      },
      overall: {
        totalExecutions,
        totalScripts,
        totalDuration,
        averageSuccessRate,
        averageDuration,
      },
      mostUsedScripts: mostUsed,
      mostFailingScripts: mostFailing,
      fastestScripts: fastest,
      slowestScripts: slowest,
      executionTrend,
      performanceTrend,
      successRateTrend,
    };
  }

  /**
   * Get statistics for a specific script
   */
  async getScriptStats(
    scriptName: string,
    options: { days?: number } = {},
  ): Promise<ScriptUsageStats> {
    const days = options.days || 30;
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

    const logger = await getExecutionLogger(this.projectRoot);

    const history = await logger.getHistory({
      scriptName,
      startDate,
      endDate,
      limit: 100000,
    });

    const stats = this.calculateScriptStats(history, days);
    const scriptStat = stats.find((s) => s.scriptName === scriptName);

    if (!scriptStat) {
      return {
        scriptName,
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        successRate: 0,
        averageDuration: 0,
        totalDuration: 0,
        lastExecution: null,
        mostCommonCommand: null,
        uniqueUsers: 0,
        executionsPerDay: 0,
      };
    }

    return scriptStat;
  }

  /**
   * Calculate per-script statistics
   */
  private calculateScriptStats(executions: ExecutionRecord[], days: number): ScriptUsageStats[] {
    const scriptMap = new Map<string, ExecutionRecord[]>();

    // Group by script
    for (const execution of executions) {
      if (!scriptMap.has(execution.scriptName)) {
        scriptMap.set(execution.scriptName, []);
      }
      scriptMap.get(execution.scriptName)?.push(execution);
    }

    // Calculate stats for each script
    const stats: ScriptUsageStats[] = [];

    for (const [scriptName, scriptExecutions] of scriptMap.entries()) {
      const totalExecutions = scriptExecutions.length;
      const successfulExecutions = scriptExecutions.filter((e) => e.success === true).length;
      const failedExecutions = totalExecutions - successfulExecutions;
      const successRate = totalExecutions > 0 ? (successfulExecutions / totalExecutions) * 100 : 0;

      const totalDuration = scriptExecutions.reduce((sum, e) => sum + (e.durationMs || 0), 0);
      const averageDuration = totalExecutions > 0 ? totalDuration / totalExecutions : 0;

      const lastExecution =
        scriptExecutions.length > 0
          ? new Date(Math.max(...scriptExecutions.map((e) => e.startedAt.getTime())))
          : null;

      // Find most common command
      const commandCounts = new Map<string, number>();
      for (const execution of scriptExecutions) {
        const count = commandCounts.get(execution.command) || 0;
        commandCounts.set(execution.command, count + 1);
      }

      let mostCommonCommand: string | null = null;
      let maxCount = 0;
      for (const [command, count] of commandCounts.entries()) {
        if (count > maxCount) {
          maxCount = count;
          mostCommonCommand = command;
        }
      }

      // Count unique users
      const uniqueUsers = new Set(scriptExecutions.map((e) => e.user)).size;

      // Calculate executions per day
      const executionsPerDay = days > 0 ? totalExecutions / days : 0;

      stats.push({
        scriptName,
        totalExecutions,
        successfulExecutions,
        failedExecutions,
        successRate,
        averageDuration,
        totalDuration,
        lastExecution,
        mostCommonCommand,
        uniqueUsers,
        executionsPerDay: Number(executionsPerDay.toFixed(1)),
      });
    }

    return stats;
  }

  /**
   * Calculate execution trend (comparing first half vs second half)
   */
  private calculateExecutionTrend(executions: ExecutionRecord[], days: number): TrendAnalysis {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);
    const midDate = new Date(startDate.getTime() + (endDate.getTime() - startDate.getTime()) / 2);

    const firstHalf = executions.filter((e) => e.startedAt < midDate);
    const secondHalf = executions.filter((e) => e.startedAt >= midDate);

    const halfDays = days / 2;
    const previousRate = firstHalf.length / halfDays;
    const currentRate = secondHalf.length / halfDays;

    const changePercent =
      previousRate > 0 ? ((currentRate - previousRate) / previousRate) * 100 : 0;

    const trend = this.getTrend(changePercent);

    // Generate daily data points
    const dataPoints = this.generateDailyDataPoints(executions, startDate, endDate, 'count');

    return {
      current: Number(currentRate.toFixed(2)),
      previous: Number(previousRate.toFixed(2)),
      changePercent: Number(changePercent.toFixed(1)),
      trend,
      dataPoints,
    };
  }

  /**
   * Calculate performance trend (average duration)
   */
  private calculatePerformanceTrend(executions: ExecutionRecord[], days: number): TrendAnalysis {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);
    const midDate = new Date(startDate.getTime() + (endDate.getTime() - startDate.getTime()) / 2);

    const firstHalf = executions.filter((e) => e.startedAt < midDate);
    const secondHalf = executions.filter((e) => e.startedAt >= midDate);

    const previousAvg =
      firstHalf.length > 0
        ? firstHalf.reduce((sum, e) => sum + (e.durationMs || 0), 0) / firstHalf.length
        : 0;

    const currentAvg =
      secondHalf.length > 0
        ? secondHalf.reduce((sum, e) => sum + (e.durationMs || 0), 0) / secondHalf.length
        : 0;

    const changePercent = previousAvg > 0 ? ((currentAvg - previousAvg) / previousAvg) * 100 : 0;

    // For performance, negative is good (faster), so invert
    const trend = this.getTrend(-changePercent);

    // Generate daily data points
    const dataPoints = this.generateDailyDataPoints(executions, startDate, endDate, 'duration');

    return {
      current: Number(currentAvg.toFixed(2)),
      previous: Number(previousAvg.toFixed(2)),
      changePercent: Number(changePercent.toFixed(1)),
      trend,
      dataPoints,
    };
  }

  /**
   * Calculate success rate trend
   */
  private calculateSuccessRateTrend(executions: ExecutionRecord[], days: number): TrendAnalysis {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);
    const midDate = new Date(startDate.getTime() + (endDate.getTime() - startDate.getTime()) / 2);

    const firstHalf = executions.filter((e) => e.startedAt < midDate);
    const secondHalf = executions.filter((e) => e.startedAt >= midDate);

    const previousRate =
      firstHalf.length > 0
        ? (firstHalf.filter((e) => e.success === true).length / firstHalf.length) * 100
        : 0;

    const currentRate =
      secondHalf.length > 0
        ? (secondHalf.filter((e) => e.success === true).length / secondHalf.length) * 100
        : 0;

    const changePercent =
      previousRate > 0 ? ((currentRate - previousRate) / previousRate) * 100 : 0;

    const trend = this.getTrend(changePercent);

    // Generate daily data points
    const dataPoints = this.generateDailyDataPoints(executions, startDate, endDate, 'success');

    return {
      current: Number(currentRate.toFixed(2)),
      previous: Number(previousRate.toFixed(2)),
      changePercent: Number(changePercent.toFixed(1)),
      trend,
      dataPoints,
    };
  }

  /**
   * Calculate activity by hour of day
   */
  async calculateActivityByHour(days = 7): Promise<ActivityByHour[]> {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

    const logger = await getExecutionLogger(this.projectRoot);
    const history = await logger.getHistory({
      startDate,
      endDate,
      limit: 100000,
    });

    const hourCounts = new Array(24).fill(0);

    for (const execution of history) {
      const hour = execution.startedAt.getHours();
      hourCounts[hour]++;
    }

    return hourCounts.map((count, hour) => ({ hour, count }));
  }

  /**
   * Calculate activity by day of week
   */
  async calculateActivityByDay(days = 7): Promise<ActivityByDay[]> {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

    const logger = await getExecutionLogger(this.projectRoot);
    const history = await logger.getHistory({
      startDate,
      endDate,
      limit: 100000,
    });

    const dayCounts = new Array(7).fill(0);
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    for (const execution of history) {
      const day = execution.startedAt.getDay();
      dayCounts[day]++;
    }

    return dayCounts.map((count, dayOfWeek) => ({
      day: dayNames[dayOfWeek],
      dayOfWeek,
      count,
    }));
  }

  /**
   * Determine trend direction
   */
  private getTrend(changePercent: number): 'improving' | 'stable' | 'degrading' {
    if (changePercent > 10) return 'improving';
    if (changePercent < -10) return 'degrading';
    return 'stable';
  }

  /**
   * Generate daily data points for trend visualization
   */
  private generateDailyDataPoints(
    executions: ExecutionRecord[],
    startDate: Date,
    endDate: Date,
    metric: 'count' | 'duration' | 'success',
  ): TrendDataPoint[] {
    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
    const dataPoints: TrendDataPoint[] = [];

    for (let i = 0; i < days; i++) {
      const dayStart = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

      const dayExecutions = executions.filter(
        (e) => e.startedAt >= dayStart && e.startedAt < dayEnd,
      );

      let value = 0;
      if (metric === 'count') {
        value = dayExecutions.length;
      } else if (metric === 'duration') {
        value =
          dayExecutions.length > 0
            ? dayExecutions.reduce((sum, e) => sum + (e.durationMs || 0), 0) / dayExecutions.length
            : 0;
      } else if (metric === 'success') {
        value =
          dayExecutions.length > 0
            ? (dayExecutions.filter((e) => e.success === true).length / dayExecutions.length) * 100
            : 0;
      }

      dataPoints.push({
        date: dayStart.toISOString().split('T')[0],
        value: Number(value.toFixed(2)),
      });
    }

    return dataPoints;
  }
}

let usageAnalyticsInstance: UsageAnalytics | null = null;

export async function getUsageAnalytics(projectRoot: string): Promise<UsageAnalytics> {
  if (!usageAnalyticsInstance) {
    const dataDir = join(projectRoot, '.revealui');
    const dbPath = join(dataDir, 'script-management.db');

    const db = new PGlite(dbPath);
    usageAnalyticsInstance = new UsageAnalytics(db, projectRoot);
    await usageAnalyticsInstance.initialize();
  }

  return usageAnalyticsInstance;
}
