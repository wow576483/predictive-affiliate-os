# Predictive Affiliate OS (V11.0)

> نظام اتخاذ قرار تنبؤي للمسوّقين بنظام الدفع عند الاستلام (COD).
> Google Sheets كواجهة عرض فقط، والحسابات في طبقة Backend (Apps Script / Node.js)
> باستخدام **نمذجة إحصائية واضحة فقط** — بلا Machine Learning أو نماذج Black-box.

A predictive decision-support system for Cash-on-Delivery (COD) affiliate
marketers. Google Sheets is the **frontend UI only**; all computation runs in a
transparent statistical backend (moving averages, variance, standard deviation,
z-scores, OLS slope). **No machine learning, no black-box models.**

## Architecture

```
 Node.js scraper ─▶ daily tabs "YYYY-MM-DD"  (INGESTION LAYER)
                         │
                         ▼
        Mb-0 Parser  (content-based: $ ⇒ Cost USD, LYD ⇒ Market Price)
                         │
                         ▼
        Time series per product (keyed by URL, accrues 7–14 days)
                         │
        ┌────────────────┼───────────────────────────────┐
        ▼                ▼                                 ▼
  Trend Quality     Opportunity Half-Life        COD Financial Engine
  & Market Capacity                              (Effective CPA, Max CPA…)
        │                                              │
        ▼                                              ▼
  Winners DNA + Similarity ───▶ Launch Confidence ──▶ Decision Explainability
                                                       │
                                                       ▼
            OPPORTUNITY RADAR · WATCHLIST · FINANCIAL CALCULATOR · WINNERS DNA
```

- **Core (`src/core/`)** — pure ES-module JavaScript, fully unit-tested in Node.
- **Apps Script glue (`src/appsscript/`)** — thin layer that reads/writes the
  sheet. The core is bundled into a single global-scope `.gs` file for GAS.

## The `Mb-0` parser

The scraper emits two columns that share the raw header `Mb-0`: one holds
**Cost (USD, contains `$`)** and the other **Market Price (LYD)**. The parser
ignores the ambiguous header and identifies each column by the **format of its
cell content** (majority vote of `$` vs `LYD`/`د.ل`), so it works regardless of
column order. See `src/core/parser.js`.

## Statistical engines (`src/core/engines/`)

| Engine | File | Output |
|---|---|---|
| False Trend Filter & Market Capacity | `trend.js` | Trend Quality (0-100), Saturation, Low/Medium/High capacity |
| Opportunity Half-Life | `halflife.js` | Remaining entry window in days |
| Winners DNA & Similarity | `winnersDna.js` | Winning fingerprint + Similarity (0-100) |
| COD Financial Engine | `financial.js` | Effective CPA, Return Penalty Burden, Expected Net Profit, Max Allowed CPA |
| Decision Explainability | `explain.js` | `+ Strong Sales Momentum \| - High Delivery Risk` |
| Composite | `confidence.js` | Launch Confidence, Urgency, Budget Allocation %, Action |

The full math is documented inline in each engine file.

## Currency

Cost is scraped in **USD**, market price in **LYD**. Margin requires a
conversion rate, configured via `fxUsdToLyd` (default `8.75`, editable in the
`_CONFIG` sheet). Choose the official or parallel-market rate as appropriate.

## Output sheets (Frontend UI — STEP 2)

The presentation layer lives in `src/appsscript/Format.gs` (header styling,
conditional color rules, data validation, number formats, charts) and is applied
by the writers in `Main.gs`. Pure presentation — no business logic.

- **OPPORTUNITY RADAR** — top 10 opportunities: `Product Name | Launch Confidence
  Score | Urgency Score | Market Capacity | Budget Allocation % | Recommended
  Action | Decision Explanation (Reasoning)`. Confidence/Urgency use a
  red→yellow→green color scale; Market Capacity and Recommended Action are
  colored chips; Budget Allocation is percent-formatted with a color scale.
- **WATCHLIST** — products where `Confidence > 60 & Saturation > 50 & Half-Life
  > 7 Days`. Same color conventions.
- **FINANCIAL CALCULATOR** — editable inputs (amber `Delivery Rate`, `Return
  Penalty`, `Target CPA`, `Risk Tier` dropdown) plus read-only outputs (grey
  `Effective CPA`, `Return Penalty Burden`, `Expected Net Profit`, `Max Allowed
  CPA`, `Profitable?`). User edits to inputs are preserved across runs; outputs
  refresh on each **Run Analysis**.
- **WINNERS DNA** — fingerprint metric cards, a category-share table, and an
  embedded column chart of winning category share.
- Hidden backend sheets: `_TIMESERIES`, `_STATE`, `_CONFIG`.

### Color & formatting conventions

| Element | Rule |
|---|---|
| 0–100 scores | gradient red (0) → yellow (50) → green (100) |
| Market Capacity | High = green, Medium = amber, Low = red |
| Recommended Action | Launch = green, Test = amber, Watch = grey, Avoid/Skip = red |
| Expected Net Profit | positive = green, ≤ 0 = red |
| Editable input cells | amber background `#FFF8E1` |
| Read-only output cells | grey background `#F2F4F7` |

## Develop

```bash
npm install
npm test          # unit + integration tests (node:test)
npm run demo      # end-to-end demo on synthetic data
npm run lint
```

## Deploy to Google Apps Script

```bash
npm run build:gs                 # bundles core -> dist/appsscript/AffiliateOSCore.gs
cd dist/appsscript && clasp push # requires clasp login + .clasp.json scriptId
```

Then in the Sheet: **Affiliate OS ▸ Run Analysis** (the `onOpen` menu).
Use **Affiliate OS ▸ Seed Demo Tabs** to create sample ingestion tabs.

## Status

- **STEP 1 (Complete)** — backend logic: parser, engines, similarity,
  explainability, and writing results into the sheet.
- **STEP 2 (Complete)** — Frontend Sheets UI: header styling, conditional
  formatting, data validation, number formats, sheet ordering, and the Winners
  DNA category chart (`src/appsscript/Format.gs`).
