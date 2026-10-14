/**
 * Public re-export of the token cost estimator.
 * Callers record estimated cost without importing the private token counter.
 */
export { type CostEstimate, estimateCost } from './token-counter.js';
