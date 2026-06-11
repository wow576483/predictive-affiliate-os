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
conversion rate, configured via `fxUsdToLyd` (default `4.85`, editable in the
`_CONFIG` sheet). Choose the official or parallel-market rate as appropriate.

## Output sheets

- **OPPORTUNITY RADAR** — top 10 opportunities: `Product Name | Launch Confidence
  Score | Urgency Score | Market Capacity | Budget Allocation % | Recommended
  Action | Decision Explanation (Reasoning)`
- **WATCHLIST** — products where `Confidence > 60 & Saturation > 50 & Half-Life
  > 7 Days`.
- **FINANCIAL CALCULATOR** — editable per-product inputs (Delivery Rate, Return
  Penalty, Target CPA, Risk Tier).
- **WINNERS DNA** — historical fingerprint and macro trends.

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
- **STEP 2 (Pending)** — detailed Sheets UI design (layout, formatting,
  dashboards), to begin after the backend is confirmed.
