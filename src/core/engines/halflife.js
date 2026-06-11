/**
 * Engine 2 — Opportunity Half-Life.
 *
 * Estimates the remaining entry window (in days) before the opportunity
 * decays toward saturation. Uses the growth deceleration of the demand
 * moving average: if growth shrinks by a roughly constant amount each day,
 * we project how long until growth reaches ~0 (the saturation point).
 */

import {
  movingAverage,
  normalizedSlope,
  finiteNumbers,
  clamp,
  scaleLinear,
} from '../stats.js';

/**
 * @returns {{days:number, label:string, basis:string}}
 */
export function opportunityHalfLife(quantities, daysInMarket, saturation, config) {
  const q = finiteNumbers(quantities);
  const { halfLife } = config;

  if (q.length < config.trend.minDays) {
    return { days: halfLife.maxDays, label: `${halfLife.maxDays} Days`, basis: 'insufficient-data' };
  }

  const window = q.slice(-config.trend.longWindow);
  const ma = movingAverage(window, Math.min(config.trend.shortWindow, window.length));

  const half = Math.max(2, Math.floor(ma.length / 2));
  const earlySlope = normalizedSlope(ma.slice(0, half));
  const recentSlope = normalizedSlope(ma.slice(-half));

  let days;
  let basis;

  if (recentSlope <= 0) {
    // Already declining: very short remaining window scaled by how negative.
    days = scaleLinear(recentSlope, -0.05, 0, halfLife.minDays, 5);
    basis = 'declining';
  } else {
    const decelPerDay = (earlySlope - recentSlope) / half; // growth lost per day
    if (decelPerDay > 1e-4) {
      // Days until recentSlope hits ~0 at the observed deceleration rate.
      days = recentSlope / decelPerDay;
      basis = 'decelerating';
    } else {
      // Growth steady/accelerating: window limited mainly by saturation/age.
      days = scaleLinear(saturation, 0, 1, halfLife.maxDays, 7);
      basis = 'steady-growth';
    }
  }

  // Tighten by current saturation pressure and age.
  days *= 1 - 0.5 * clamp(saturation, 0, 1);
  const ageFactor = scaleLinear(daysInMarket, 0, config.capacity.matureDays * 2, 1, 0.5);
  days *= ageFactor;

  days = Math.round(clamp(days, halfLife.minDays, halfLife.maxDays));
  return { days, label: `${days} Days`, basis };
}
