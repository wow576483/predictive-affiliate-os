/** Public backend API surface (bundled into a global for Apps Script). */
export { parseDailyTab, parseNumber, detectColumns, detectCurrency } from './parser.js';
export { buildTimeSeries, computeMargin } from './timeseries.js';
export { runPipeline } from './pipeline.js';
export { DEFAULT_CONFIG, resolveConfig } from './config.js';
