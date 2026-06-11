/**
 * Ingestion parser for raw daily scraper tabs.
 *
 * The scraper emits two columns that share the same raw header label `Mb-0`:
 * one holds Cost in USD (contains a `$`) and the other Market Price in LYD
 * (contains `LYD`/`د.ل`). We therefore identify these two columns by the
 * FORMAT OF THEIR CELL CONTENT, never by the (ambiguous) header text.
 */

const URL_RE = /url|link|product[_\s-]*url/i;
const NAME_RE = /product[_\s-]*name|name|title|product$/i;
const BADGE_RE = /badge|categor|tag/i;
const QTY_RE = /quantity|qty|sales|sold|orders|count/i;

const USD_RE = /\$|\busd\b|dollar/i;
const LYD_RE = /lyd|د\.?\s*ل|dinar|ل\.د/i;

/**
 * Extract a clean float from a messy cell value.
 * Handles `$12.50`, `12,50 LYD`, `1 234.56`, `د.ل 45`, numbers, etc.
 * Returns null when no number is present.
 */
export function parseNumber(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  let s = String(value).trim();
  if (!s) return null;

  // Strip currency words/symbols and Arabic markers, keep digits/.,/-/space.
  s = s.replace(/usd|lyd|dinar|دينار|د\.?\s*ل|ل\.د|\$/gi, ' ');
  // Keep only number-relevant characters.
  s = s.replace(/[^\d.,\- ]/g, ' ').trim();
  if (!s) return null;
  // Collapse spaces used as thousands separators (e.g. "1 450" -> "1450").
  s = s.replace(/(?<=\d)\s+(?=\d)/g, '');
  if (!s) return null;

  // Take the first number-like token.
  const token = s.split(/\s+/).find((t) => /\d/.test(t));
  if (!token) return null;

  let cleaned = token;
  const hasComma = cleaned.includes(',');
  const hasDot = cleaned.includes('.');
  if (hasComma && hasDot) {
    // Whichever separator appears last is the decimal separator.
    if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      cleaned = cleaned.replace(/,/g, '');
    }
  } else if (hasComma) {
    // Comma as decimal (e.g. "12,50") vs thousands ("1,234").
    const parts = cleaned.split(',');
    if (parts.length === 2 && parts[1].length !== 3) {
      cleaned = `${parts[0]}.${parts[1]}`;
    } else {
      cleaned = cleaned.replace(/,/g, '');
    }
  }
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Classify a single cell's currency by content. */
export function detectCurrency(value) {
  if (value === null || value === undefined) return null;
  const s = String(value);
  if (USD_RE.test(s)) return 'usd';
  if (LYD_RE.test(s)) return 'lyd';
  return null;
}

/** Majority currency vote over a sample of cells in a column. */
function columnCurrency(cells) {
  let usd = 0;
  let lyd = 0;
  for (const c of cells) {
    const cur = detectCurrency(c);
    if (cur === 'usd') usd += 1;
    else if (cur === 'lyd') lyd += 1;
  }
  if (usd === 0 && lyd === 0) return null;
  return usd >= lyd ? 'usd' : 'lyd';
}

function headerRole(header) {
  const h = String(header || '').trim();
  if (URL_RE.test(h)) return 'url';
  if (BADGE_RE.test(h)) return 'badge';
  if (QTY_RE.test(h)) return 'quantity';
  if (NAME_RE.test(h)) return 'productName';
  return null;
}

/**
 * Build a column-index → role map.
 * Known columns resolved by header; the two ambiguous `Mb-0` numeric columns
 * (cost/price) resolved by sampling their cell content for `$` vs `LYD`.
 */
export function detectColumns(header, dataRows) {
  const roleByIndex = {};
  const usedRoles = new Set();
  const ambiguous = [];

  header.forEach((h, idx) => {
    const role = headerRole(h);
    if (role && !usedRoles.has(role)) {
      roleByIndex[idx] = role;
      usedRoles.add(role);
    } else {
      ambiguous.push(idx);
    }
  });

  // Resolve ambiguous numeric columns (cost/price) by content currency.
  const sample = dataRows.slice(0, 50);
  const scored = ambiguous.map((idx) => ({
    idx,
    currency: columnCurrency(sample.map((r) => r[idx])),
  }));

  const usdCol = scored.find((c) => c.currency === 'usd');
  const lydCol = scored.find((c) => c.currency === 'lyd' && (!usdCol || c.idx !== usdCol.idx));
  if (usdCol) {
    roleByIndex[usdCol.idx] = 'costUsd';
    usedRoles.add('costUsd');
  }
  if (lydCol) {
    roleByIndex[lydCol.idx] = 'priceLyd';
    usedRoles.add('priceLyd');
  }

  // Fallback: if name/url unresolved, assign first leftover text-ish column.
  if (!usedRoles.has('productName')) {
    const leftover = ambiguous.find(
      (idx) => roleByIndex[idx] === undefined && sample.some((r) => typeof r[idx] === 'string' && r[idx].trim()),
    );
    if (leftover !== undefined) {
      roleByIndex[leftover] = 'productName';
      usedRoles.add('productName');
    }
  }

  return roleByIndex;
}

/**
 * Parse a daily tab into normalized records.
 * @param {Array<Array>} rows grid including header row at index 0.
 * @param {{date: string}} meta the tab date (e.g. "2026-06-09").
 * @returns {Array<object>} normalized records.
 */
export function parseDailyTab(rows, meta = {}) {
  if (!Array.isArray(rows) || rows.length < 2) return [];
  const header = rows[0];
  const dataRows = rows.slice(1).filter((r) => Array.isArray(r) && r.some((c) => c !== '' && c !== null && c !== undefined));
  const cols = detectColumns(header, dataRows);

  const indexByRole = {};
  for (const [idx, role] of Object.entries(cols)) {
    indexByRole[role] = Number(idx);
  }

  const records = [];
  for (const row of dataRows) {
    const url = indexByRole.url !== undefined ? String(row[indexByRole.url] || '').trim() : '';
    const productName = indexByRole.productName !== undefined ? String(row[indexByRole.productName] || '').trim() : '';
    if (!url && !productName) continue;

    records.push({
      date: meta.date || '',
      url: url || productName, // URL is the stable key; fall back to name
      productName: productName || url,
      badge: indexByRole.badge !== undefined ? String(row[indexByRole.badge] || '').trim() : '',
      costUsd: indexByRole.costUsd !== undefined ? parseNumber(row[indexByRole.costUsd]) : null,
      priceLyd: indexByRole.priceLyd !== undefined ? parseNumber(row[indexByRole.priceLyd]) : null,
      quantity: indexByRole.quantity !== undefined ? parseNumber(row[indexByRole.quantity]) : null,
    });
  }
  return records;
}
