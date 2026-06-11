/**
 * Pure statistical primitives.
 *
 * Deliberately simple and transparent: moving averages, variance, standard
 * deviation, coefficient of variation, z-scores and ordinary-least-squares
 * slope. No machine learning, no black-box models.
 */

/** Numeric guard: returns finite numbers only, drops null/NaN/Infinity. */
export function finiteNumbers(values) {
  return values.filter((v) => typeof v === 'number' && Number.isFinite(v));
}

export function sum(values) {
  return finiteNumbers(values).reduce((acc, v) => acc + v, 0);
}

export function mean(values) {
  const nums = finiteNumbers(values);
  if (nums.length === 0) return 0;
  return sum(nums) / nums.length;
}

/** Population variance (divides by N). */
export function variance(values) {
  const nums = finiteNumbers(values);
  if (nums.length === 0) return 0;
  const m = mean(nums);
  return mean(nums.map((v) => (v - m) ** 2));
}

/** Sample variance (divides by N-1); falls back to 0 for n<2. */
export function sampleVariance(values) {
  const nums = finiteNumbers(values);
  if (nums.length < 2) return 0;
  const m = mean(nums);
  const ss = nums.reduce((acc, v) => acc + (v - m) ** 2, 0);
  return ss / (nums.length - 1);
}

export function stddev(values) {
  return Math.sqrt(variance(values));
}

export function sampleStddev(values) {
  return Math.sqrt(sampleVariance(values));
}

/**
 * Coefficient of variation = stddev / mean.
 * Unitless measure of relative dispersion. Returns 0 when mean is ~0.
 */
export function coefficientOfVariation(values) {
  const m = mean(values);
  if (Math.abs(m) < 1e-9) return 0;
  return stddev(values) / m;
}

/** Trailing simple moving average over a window. */
export function movingAverage(values, window) {
  const nums = finiteNumbers(values);
  if (window <= 0 || nums.length === 0) return [];
  const out = [];
  for (let i = 0; i < nums.length; i += 1) {
    const start = Math.max(0, i - window + 1);
    out.push(mean(nums.slice(start, i + 1)));
  }
  return out;
}

/** Z-scores using population stddev. Returns zeros when stddev is ~0. */
export function zScores(values) {
  const nums = finiteNumbers(values);
  const m = mean(nums);
  const sd = stddev(nums);
  if (sd < 1e-9) return nums.map(() => 0);
  return nums.map((v) => (v - m) / sd);
}

/**
 * Ordinary least squares slope of values against their index (0..n-1).
 * Positive slope = upward trend. Returns 0 for n<2.
 */
export function olsSlope(values) {
  const nums = finiteNumbers(values);
  const n = nums.length;
  if (n < 2) return 0;
  const xs = nums.map((_, i) => i);
  const mx = mean(xs);
  const my = mean(nums);
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i += 1) {
    num += (xs[i] - mx) * (nums[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  if (Math.abs(den) < 1e-9) return 0;
  return num / den;
}

/** Slope normalized by the series mean → relative growth per step. */
export function normalizedSlope(values) {
  const m = mean(values);
  if (Math.abs(m) < 1e-9) return 0;
  return olsSlope(values) / m;
}

export function clamp(value, lo, hi) {
  if (!Number.isFinite(value)) return lo;
  return Math.min(hi, Math.max(lo, value));
}

/** Linearly map x from [inLo,inHi] to [outLo,outHi], clamped to output range. */
export function scaleLinear(x, inLo, inHi, outLo, outHi) {
  if (Math.abs(inHi - inLo) < 1e-9) return outLo;
  const t = (x - inLo) / (inHi - inLo);
  return clamp(outLo + t * (outHi - outLo), Math.min(outLo, outHi), Math.max(outLo, outHi));
}

export function lastOf(values) {
  const nums = finiteNumbers(values);
  return nums.length ? nums[nums.length - 1] : 0;
}
