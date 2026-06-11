/**
 * Aggregates normalized daily records into per-product time series keyed by
 * URL (the stable identity). Engines consume these series.
 */

function daysBetween(isoA, isoB) {
  const a = Date.parse(isoA);
  const b = Date.parse(isoB);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86400000);
}

/**
 * @param {Array<object>} records flat list of normalized daily records.
 * @returns {Array<object>} products with ordered series and derived metadata.
 */
export function buildTimeSeries(records) {
  const byKey = new Map();

  for (const rec of records) {
    const key = rec.url || rec.productName;
    if (!key) continue;
    if (!byKey.has(key)) {
      byKey.set(key, {
        url: rec.url,
        productName: rec.productName,
        badge: rec.badge,
        byDate: new Map(),
      });
    }
    const product = byKey.get(key);
    // Keep latest non-empty metadata.
    if (rec.productName) product.productName = rec.productName;
    if (rec.badge) product.badge = rec.badge;
    // One observation per date (last write wins for duplicates within a day).
    product.byDate.set(rec.date, {
      date: rec.date,
      quantity: rec.quantity,
      costUsd: rec.costUsd,
      priceLyd: rec.priceLyd,
    });
  }

  const products = [];
  for (const product of byKey.values()) {
    const series = [...product.byDate.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)));
    if (series.length === 0) continue;
    const firstSeen = series[0].date;
    const lastSeen = series[series.length - 1].date;
    products.push({
      url: product.url,
      productName: product.productName,
      badge: product.badge,
      series,
      firstSeen,
      lastSeen,
      daysInMarket: daysBetween(firstSeen, lastSeen) + 1,
      quantities: series.map((s) => s.quantity),
      latestCostUsd: lastDefined(series.map((s) => s.costUsd)),
      latestPriceLyd: lastDefined(series.map((s) => s.priceLyd)),
    });
  }
  return products;
}

function lastDefined(values) {
  for (let i = values.length - 1; i >= 0; i -= 1) {
    if (typeof values[i] === 'number' && Number.isFinite(values[i])) return values[i];
  }
  return null;
}

/**
 * Margin in USD and as a fraction of revenue.
 * priceLyd converted to USD via fx; margin = priceUsd - costUsd.
 */
export function computeMargin(product, fxUsdToLyd) {
  const cost = product.latestCostUsd;
  const priceLyd = product.latestPriceLyd;
  if (cost === null || priceLyd === null || !fxUsdToLyd) {
    return { priceUsd: null, marginUsd: null, marginPct: null };
  }
  const priceUsd = priceLyd / fxUsdToLyd;
  const marginUsd = priceUsd - cost;
  const marginPct = priceUsd > 0 ? marginUsd / priceUsd : null;
  return { priceUsd, marginUsd, marginPct };
}
