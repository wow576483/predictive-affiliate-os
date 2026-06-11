/**
 * Deterministic multi-day record generator for pipeline/engine tests.
 * Produces normalized records (post-parse shape) for several products with
 * distinct demand patterns: sustained growth, isolated spike, flat, decline.
 */

function isoDate(dayOffset) {
  const base = Date.parse('2026-06-01T00:00:00Z');
  return new Date(base + dayOffset * 86400000).toISOString().slice(0, 10);
}

function makeRecords({ url, name, badge, costUsd, priceLyd, quantities }) {
  return quantities.map((q, i) => ({
    date: isoDate(i),
    url,
    productName: name,
    badge,
    costUsd,
    priceLyd,
    quantity: q,
  }));
}

export function multiDayRecords() {
  const sustained = makeRecords({
    url: 'u/winner-1',
    name: 'Sustained Grower',
    badge: 'Health',
    costUsd: 5,
    priceLyd: 95, // ~19.6 USD @ fx 4.85 -> healthy margin
    quantities: [40, 46, 52, 58, 66, 73, 81, 90, 99, 110, 121, 133, 146, 160],
  });

  const spike = makeRecords({
    url: 'u/spike-1',
    name: 'Isolated Spike',
    badge: 'Gadgets',
    costUsd: 6,
    priceLyd: 70,
    quantities: [20, 18, 22, 19, 21, 230, 25, 20, 18, 22, 19, 21, 20, 23],
  });

  const flat = makeRecords({
    url: 'u/flat-1',
    name: 'Flat Demand',
    badge: 'Home',
    costUsd: 4,
    priceLyd: 40,
    quantities: [50, 49, 51, 50, 48, 52, 50, 49, 51, 50, 50, 49, 51, 50],
  });

  const decline = makeRecords({
    url: 'u/decline-1',
    name: 'Declining',
    badge: 'Home',
    costUsd: 7,
    priceLyd: 50,
    quantities: [200, 180, 160, 140, 120, 100, 85, 72, 60, 50, 42, 35, 30, 26],
  });

  return [...sustained, ...spike, ...flat, ...decline];
}
