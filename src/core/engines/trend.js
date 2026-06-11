/**
 * Engine 1 — False Trend Filter & Market Capacity.
 *
 * Trend Quality Score (0-100): rewards sustained growth (positive moving-
 * average slope + low relative dispersion) and punishes isolated spikes
 * (a single high-z-score day with otherwise flat demand = a fake trend).
 *
 * Market Capacity (Low/Medium/High): derived from a saturation probability
 * that grows as the demand curve flattens and as the product ages.
 */

import {
  coefficientOfVariation,
  movingAverage,
  normalizedSlope,
  zScores,
  clamp,
  scaleLinear,
  finiteNumbers,
  mean,
  olsSlope,
} from '../stats.js';

/**
 * @returns {{score:number, components:object}} trend quality on 0-100.
 */
export function trendQualityScore(quantities, config) {
  const q = finiteNumbers(quantities);
  const { trend } = config;
  if (q.length < trend.minDays) {
    // Not enough history: neutral-low score, flagged as insufficient.
    return {
      score: 40,
      components: { insufficientData: true, days: q.length },
    };
  }

  const window = q.slice(-trend.longWindow);

  // 1. Direction: positive normalized slope of the moving average is good.
  const ma = movingAverage(window, Math.min(trend.shortWindow, window.length));
  const slope = normalizedSlope(ma); // relative growth per day
  const slopeScore = scaleLinear(slope, -0.05, 0.1, 0, 100); // -5%/day..+10%/day

  // 2. Stability: low coefficient of variation = sustainable, not erratic.
  const cv = coefficientOfVariation(window);
  const stabilityScore = scaleLinear(cv, 0.8, 0.1, 0, 100); // high cv -> low

  // 3. Spike penalty: a single isolated day dominating the series is suspect.
  // Detected when one day has a large z-score, no other day does, and overall
  // demand is erratic (high CV) rather than steadily growing.
  const z = zScores(window);
  const maxZ = z.length ? Math.max(...z) : 0;
  const spikeDays = z.filter((v) => v >= trend.spikeZThreshold).length;
  const isolatedSpike = maxZ >= trend.spikeZThreshold && spikeDays <= 1 && cv >= 0.5;
  const spikePenalty = isolatedSpike ? clamp((maxZ - trend.spikeZThreshold) * 20 + 25, 0, 60) : 0;

  const raw = 0.55 * slopeScore + 0.45 * stabilityScore - spikePenalty;
  const score = Math.round(clamp(raw, 0, 100));

  return {
    score,
    components: {
      slope,
      slopeScore: Math.round(slopeScore),
      cv: Number(cv.toFixed(3)),
      stabilityScore: Math.round(stabilityScore),
      maxZ: Number(maxZ.toFixed(2)),
      isolatedSpike,
      spikePenalty: Math.round(spikePenalty),
    },
  };
}

/**
 * Saturation probability (0-1): how close the product is to its ceiling.
 * Weighted blend of three bounded signals:
 *   - plateau:  recent growth flat/negative (still climbing => not saturated)
 *   - age:      older products are likelier saturated
 *   - peakFlat: demand sitting near its own historical peak while flat
 */
export function saturationProbability(quantities, daysInMarket, config) {
  const q = finiteNumbers(quantities);
  if (q.length < 2) return 0.2;

  const window = q.slice(-config.trend.longWindow);
  const recent = window.slice(-Math.min(config.trend.shortWindow, window.length));
  const slopeNorm = normalizedSlope(recent); // relative growth/day
  const recentMean = mean(recent);
  const peak = Math.max(...window);

  // Fast growth -> 0; flat/declining -> 1.
  const plateauSignal = scaleLinear(slopeNorm, 0.06, -0.02, 0, 1);
  // Older -> closer to 1.
  const ageSignal = scaleLinear(daysInMarket, 0, config.capacity.matureDays * 2, 0, 1);
  // Only meaningful when growth has stalled: how close demand sits to its peak.
  const isFlat = Math.abs(slopeNorm) < 0.01 || olsSlope(recent) <= 0;
  const peakFlatSignal = isFlat && peak > 0 ? clamp(recentMean / peak, 0, 1) : 0;

  return clamp(0.45 * plateauSignal + 0.35 * ageSignal + 0.2 * peakFlatSignal, 0, 1);
}

/** Map saturation probability to Low/Medium/High remaining market capacity. */
export function marketCapacity(quantities, daysInMarket, config) {
  const sat = saturationProbability(quantities, daysInMarket, config);
  let label;
  if (sat <= config.capacity.highCapacityMaxSaturation) label = 'High';
  else if (sat <= config.capacity.mediumCapacityMaxSaturation) label = 'Medium';
  else label = 'Low';
  return { label, saturation: sat, saturationPct: Math.round(sat * 100) };
}
