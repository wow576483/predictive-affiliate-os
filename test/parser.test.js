import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseNumber, detectCurrency, detectColumns, parseDailyTab,
} from '../src/core/parser.js';
import { RAW_DAILY_TAB, RAW_DAILY_TAB_SWAPPED } from './fixtures/sampleDailyTab.js';
import { REAL_DAY_2026_06_08, REAL_DAY_2026_06_11 } from './fixtures/realScraperSample.js';

test('parseNumber handles currency symbols and separators', () => {
  assert.equal(parseNumber('$12.50'), 12.5);
  assert.equal(parseNumber('95 LYD'), 95);
  assert.equal(parseNumber('USD 6.00'), 6);
  assert.equal(parseNumber('1 450 د.ل'), 1450);
  assert.equal(parseNumber('18,90'), 18.9); // comma decimal
  assert.equal(parseNumber('1,234'), 1234); // comma thousands
  assert.equal(parseNumber(''), null);
  assert.equal(parseNumber(null), null);
  assert.equal(parseNumber(42), 42);
});

test('detectCurrency by content', () => {
  assert.equal(detectCurrency('$12.50'), 'usd');
  assert.equal(detectCurrency('95 LYD'), 'lyd');
  assert.equal(detectCurrency('1 450 د.ل'), 'lyd');
  assert.equal(detectCurrency('plain text'), null);
});

test('detectColumns resolves duplicate Mb-0 by content', () => {
  const map = detectColumns(RAW_DAILY_TAB[0], RAW_DAILY_TAB.slice(1));
  // Column 3 = USD, column 4 = LYD per fixture
  assert.equal(map[3], 'costUsd');
  assert.equal(map[4], 'priceLyd');
  assert.equal(map[0], 'url');
  assert.equal(map[5], 'quantity');
});

test('parseDailyTab produces normalized records', () => {
  const recs = parseDailyTab(RAW_DAILY_TAB, { date: '2026-06-09' });
  assert.equal(recs.length, 5);
  const first = recs[0];
  assert.equal(first.costUsd, 12.5);
  assert.equal(first.priceLyd, 95);
  assert.equal(first.quantity, 120);
  assert.equal(first.badge, 'Health');
  assert.equal(first.date, '2026-06-09');
});

test('parser is order-independent for the two Mb-0 columns', () => {
  const recs = parseDailyTab(RAW_DAILY_TAB_SWAPPED, { date: '2026-06-09' });
  // Even with LYD column first, costUsd must still be the USD value.
  assert.equal(recs[0].costUsd, 12.5);
  assert.equal(recs[0].priceLyd, 95);
});

test('messy rows parse correctly', () => {
  const recs = parseDailyTab(RAW_DAILY_TAB, { date: '2026-06-09' });
  const watch = recs.find((r) => r.productName === 'Smart Watch X8');
  assert.equal(watch.costUsd, 18.9);
  assert.equal(watch.priceLyd, 1450);
});

// ---- Regression: real scraper export (seller.shipeh.com) ----------------

test('real sample: resolves the two Mb-0 columns by content (with trailing empties)', () => {
  const map = detectColumns(REAL_DAY_2026_06_08[0], REAL_DAY_2026_06_08.slice(1));
  assert.equal(map[0], 'url');
  assert.equal(map[3], 'costUsd');
  assert.equal(map[4], 'priceLyd');
  assert.equal(map[5], 'quantity');
});

test('real sample: parses $ cost and LYD price, preserving Arabic names', () => {
  const recs = parseDailyTab(REAL_DAY_2026_06_11, { date: '2026-06-11' });
  const shoe = recs.find((r) => r.url.endsWith('/ahdiya-rijal'));
  assert.equal(shoe.productName, 'احدية رجال عصرية');
  assert.equal(shoe.badge, 'Fashion');
  assert.equal(shoe.costUsd, 10);
  assert.equal(shoe.priceLyd, 219);
  assert.equal(shoe.quantity, 7);

  const air = recs.find((r) => r.url.endsWith('/martaba-hawaiya-v2'));
  assert.equal(air.costUsd, 15.6);
  assert.equal(air.priceLyd, 369);
  assert.equal(air.quantity, 200);
});

test('real sample: scraper gaps degrade gracefully (no crash, null fields)', () => {
  // cost present, LYD price missing.
  const d11 = parseDailyTab(REAL_DAY_2026_06_11, { date: '2026-06-11' });
  const partial = d11.find((r) => r.url.endsWith('/ustuwana-tilaa'));
  assert.equal(partial.costUsd, 8.12);
  assert.equal(partial.priceLyd, null);
  assert.equal(partial.quantity, 96);

  // URL-only row: name falls back to URL, numeric fields null.
  const d08 = parseDailyTab(REAL_DAY_2026_06_08, { date: '2026-06-08' });
  const urlOnly = d08.find((r) => r.url.endsWith('/kursi-takhyeem'));
  assert.ok(urlOnly, 'URL-only row should still be parsed');
  assert.equal(urlOnly.costUsd, null);
  assert.equal(urlOnly.priceLyd, null);
  assert.equal(urlOnly.quantity, null);
});
