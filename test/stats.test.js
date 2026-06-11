import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mean, variance, stddev, coefficientOfVariation, movingAverage,
  zScores, olsSlope, normalizedSlope, clamp, scaleLinear,
} from '../src/core/stats.js';

test('mean ignores non-finite values', () => {
  assert.equal(mean([2, 4, null, NaN, 6]), 4);
  assert.equal(mean([]), 0);
});

test('variance and stddev', () => {
  assert.equal(variance([2, 2, 2]), 0);
  assert.ok(Math.abs(stddev([1, 2, 3, 4, 5]) - Math.sqrt(2)) < 1e-9);
});

test('coefficient of variation', () => {
  assert.equal(coefficientOfVariation([0, 0, 0]), 0);
  assert.ok(coefficientOfVariation([10, 12, 11, 13]) < 0.2);
});

test('movingAverage trailing window', () => {
  const ma = movingAverage([1, 2, 3, 4], 2);
  assert.deepEqual(ma, [1, 1.5, 2.5, 3.5]);
});

test('zScores zero when flat', () => {
  assert.deepEqual(zScores([5, 5, 5]), [0, 0, 0]);
});

test('olsSlope positive for increasing series', () => {
  assert.ok(olsSlope([1, 2, 3, 4, 5]) > 0.9);
  assert.ok(olsSlope([5, 4, 3, 2, 1]) < 0);
});

test('normalizedSlope is relative', () => {
  assert.ok(normalizedSlope([100, 110, 120, 130]) > 0);
});

test('clamp and scaleLinear', () => {
  assert.equal(clamp(5, 0, 3), 3);
  assert.equal(clamp(-1, 0, 3), 0);
  assert.equal(scaleLinear(0.5, 0, 1, 0, 100), 50);
  assert.equal(scaleLinear(2, 0, 1, 0, 100), 100); // clamped
});
