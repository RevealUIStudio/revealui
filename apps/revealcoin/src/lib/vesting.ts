import { DEPLOY_DATE } from './constants';

export interface VestingSchedule {
  name: string;
  type: 'cliff-linear' | 'lockup-release' | 'front-loaded';
  /** Human-readable amount (already divided by 10^decimals) */
  totalAmount: number;
  startDate: string;
  cliffDate: string | null;
  endDate: string;
  /** For front-loaded: percentage emitted each year */
  annualRates?: number[];
  description: string;
  totalDuration: string;
}

function addMonths(date: Date, months: number): string {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

const deployDate = new Date(DEPLOY_DATE);

export const VESTING_SCHEDULES: VestingSchedule[] = [
  {
    name: 'Team & Founders',
    type: 'cliff-linear',
    totalAmount: 8_835_900_000,
    startDate: DEPLOY_DATE,
    cliffDate: addMonths(deployDate, 12),
    endDate: addMonths(deployDate, 48),
    description: '12-month cliff, then 36-month linear vest',
    totalDuration: '4 years',
  },
  {
    name: 'Strategic Partners',
    type: 'cliff-linear',
    totalAmount: 2_945_300_000,
    startDate: DEPLOY_DATE,
    cliffDate: addMonths(deployDate, 6),
    endDate: addMonths(deployDate, 24),
    description: '6-month cliff, then 18-month linear vest',
    totalDuration: '2 years',
  },
  {
    name: 'Liquidity Provision',
    type: 'lockup-release',
    totalAmount: 5_301_540_000, // 90% of allocation (10% pool seed carved out)
    startDate: DEPLOY_DATE,
    cliffDate: addMonths(deployDate, 6),
    endDate: addMonths(deployDate, 18),
    description: '6-month lockup, then 12-month gradual release (90% in custody)',
    totalDuration: '18 months',
  },
  {
    name: 'Ecosystem Rewards',
    type: 'front-loaded',
    totalAmount: 17_671_800_000,
    startDate: DEPLOY_DATE,
    cliffDate: null,
    endDate: addMonths(deployDate, 60),
    annualRates: [30, 25, 20, 15, 10],
    description: 'Front-loaded: 30%, 25%, 20%, 15%, 10% per year',
    totalDuration: '5 years',
  },
];

export type VestingStatus = 'cliff' | 'locked' | 'vesting' | 'complete';

export interface VestingState {
  schedule: VestingSchedule;
  status: VestingStatus;
  percentVested: number;
  amountVested: number;
  amountLocked: number;
  nextMilestone: { label: string; date: string } | null;
  daysUntilNextMilestone: number | null;
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function daysUntil(targetMs: number, nowMs: number): number {
  return Math.ceil((targetMs - nowMs) / MS_PER_DAY);
}

function calculateFrontLoaded(schedule: VestingSchedule, now: Date): VestingState {
  const rates = schedule.annualRates ?? [];
  const start = new Date(schedule.startDate);
  const nowMs = now.getTime();

  let cumulativePercent = 0;
  let currentYearIndex = -1;

  for (let i = 0; i < rates.length; i++) {
    const yearStart = new Date(start);
    yearStart.setFullYear(yearStart.getFullYear() + i);
    const yearEnd = new Date(start);
    yearEnd.setFullYear(yearEnd.getFullYear() + i + 1);

    const rate = rates[i] ?? 0;
    if (nowMs >= yearEnd.getTime()) {
      cumulativePercent += rate;
    } else if (nowMs >= yearStart.getTime()) {
      currentYearIndex = i;
      const yearElapsed = nowMs - yearStart.getTime();
      const yearDuration = yearEnd.getTime() - yearStart.getTime();
      cumulativePercent += rate * (yearElapsed / yearDuration);
      break;
    } else {
      break;
    }
  }

  cumulativePercent = Math.min(cumulativePercent, 100);
  const amountVested = Math.floor(schedule.totalAmount * (cumulativePercent / 100));

  let nextMilestone: VestingState['nextMilestone'] = null;
  let daysLeft: number | null = null;

  if (currentYearIndex >= 0 && currentYearIndex < rates.length) {
    const yearEnd = new Date(start);
    yearEnd.setFullYear(yearEnd.getFullYear() + currentYearIndex + 1);
    daysLeft = daysUntil(yearEnd.getTime(), nowMs);
    nextMilestone = {
      label: `Year ${currentYearIndex + 1} complete (${String(rates[currentYearIndex])}%)`,
      date: yearEnd.toISOString().slice(0, 10),
    };
  }

  return {
    schedule,
    status: cumulativePercent >= 100 ? 'complete' : 'vesting',
    percentVested: cumulativePercent,
    amountVested,
    amountLocked: schedule.totalAmount - amountVested,
    nextMilestone,
    daysUntilNextMilestone: daysLeft,
  };
}

export function calculateVestingState(
  schedule: VestingSchedule,
  now: Date = new Date(),
): VestingState {
  const start = new Date(schedule.startDate).getTime();
  const end = new Date(schedule.endDate).getTime();
  const cliff = schedule.cliffDate ? new Date(schedule.cliffDate).getTime() : null;
  const nowMs = now.getTime();

  if (nowMs >= end) {
    return {
      schedule,
      status: 'complete',
      percentVested: 100,
      amountVested: schedule.totalAmount,
      amountLocked: 0,
      nextMilestone: null,
      daysUntilNextMilestone: null,
    };
  }

  if (schedule.type === 'front-loaded') {
    return calculateFrontLoaded(schedule, now);
  }

  // Before cliff/lockup  -  nothing vested
  if (cliff && nowMs < cliff) {
    return {
      schedule,
      status: schedule.type === 'lockup-release' ? 'locked' : 'cliff',
      percentVested: 0,
      amountVested: 0,
      amountLocked: schedule.totalAmount,
      nextMilestone: {
        label: schedule.type === 'lockup-release' ? 'Lockup ends' : 'Cliff ends',
        date: schedule.cliffDate ?? new Date(cliff).toISOString().slice(0, 10),
      },
      daysUntilNextMilestone: daysUntil(cliff, nowMs),
    };
  }

  // Linear vesting phase (after cliff)
  const vestingStart = cliff ?? start;
  const elapsed = nowMs - vestingStart;
  const vestingDuration = end - vestingStart;
  const linearProgress = Math.min(elapsed / vestingDuration, 1);

  // For cliff-linear, the cliff portion unlocks retroactively at cliff date
  let percentVested: number;
  if (schedule.type === 'cliff-linear' && cliff) {
    const cliffPortion = (cliff - start) / (end - start);
    percentVested = (cliffPortion + (1 - cliffPortion) * linearProgress) * 100;
  } else {
    percentVested = linearProgress * 100;
  }

  percentVested = Math.min(percentVested, 100);
  const amountVested = Math.floor(schedule.totalAmount * (percentVested / 100));

  return {
    schedule,
    status: 'vesting',
    percentVested,
    amountVested,
    amountLocked: schedule.totalAmount - amountVested,
    nextMilestone: { label: 'Fully vested', date: schedule.endDate },
    daysUntilNextMilestone: daysUntil(end, nowMs),
  };
}
