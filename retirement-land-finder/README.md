# 🏡 Retirement Land Finder (Thailand)

An interactive desktop web app for choosing retirement land that is **close to
nature but also close to hospitals / department stores**, **under a budget**
(default ฿2,000,000), with **live government appraisal prices**, **cross-site
"cheapest source" detection**, a **weighted scoring comparison**, and
**Excel export**.

Regions covered out of the box: **Khao Yai / Nakhon Ratchasima**,
**Hua Hin / Prachuap**, **Chiang Mai**, and the **Bangkok green belt**
(Nakhon Nayok / Kanchanaburi).

---

## Quick start

```bash
cd retirement-land-finder
npm install
npm run dev
```

Then open the URL Vite prints (default **http://localhost:5173**).
The API runs on **http://localhost:5175** and Vite proxies `/api` to it.

> `npm install` also tries to download a headless Chromium for the scrapers
> (via the optional `playwright` dependency). If that fails, the rest of the
> app is unaffected — scrapers just stay unavailable until you install it with
> `npm --workspace server exec playwright install chromium`.

---

## What is real vs. sample data

| Data | Source | Status |
|---|---|---|
| **Government land appraisal price** (บัญชีราคาประเมินที่ดิน, THB / ตร.ว.) | Treasury Dept + Dept of Lands public ArcGIS service behind `assessprice.treasury.go.th` | **LIVE.** No API key, no proxy. Resolved per-point via OSM Nominatim → province → parcel polygon. Falls back to a heuristic model when a point has no digitised parcel. |
| **Land listings** (price, area, photos) | DDproperty, Kaidee, Baania | **Scrapers included but OFF by default.** These sites block bots; they need a residential proxy to work. Until then the app uses realistic **SAMPLE** listings so every feature is usable. |
| Distances to hospitals / malls / markets / nature / airports | Curated POI list in `server/src/data/regions.json` | Static, editable. Coordinates are approximate. |

### Sample listings

`npm run seed` regenerates `server/src/data/seed-listings.json` (deterministic,
~44 parcels including a few intentional cross-site duplicates so the
"cheapest source" logic has something to chew on). Edit that file or the
generator in `server/src/seed/generate.ts` to taste.

---

## Live government appraisal — how it works

`server/src/appraisal/treasury.ts`

1. Reverse-geocode the parcel point to a Thai province (Nominatim, cached; for
   the four built-in regions the province is known so no call is made).
2. From the Treasury `MapServer/layers` list, pick that province's Chanote /
   Nor Sor 3 Gor **feature layer**.
3. ArcGIS `/{layer}/query` with a ~40 m envelope around the point, read
   `CURR_EVAPRICE` (current appraised THB per sq wah), `PREV_EVAPRICE`,
   `CHANOD_NO`, `LAND_AREA`, tambon / amphoe / changwat.
4. `valueRatio = asking price / (appraisal per wah × parcel wah)` — under `1.0`
   means the parcel is **priced below the official appraisal**.

You can hit it directly:

```bash
curl -X POST http://localhost:5175/api/appraisal \
  -H 'content-type: application/json' \
  -d '{"lat":13.7466,"lng":100.5347,"landAreaSqm":1600}'
```

---

## Scrapers & the scheduled crawler

`server/src/scrapers/*` — one Playwright adapter per site plus a shared runner
with block detection and polite delays.

- **Disabled by default.** Set `ENABLE_CRAWLER=true` in `.env` to schedule it
  (`CRAWLER_CRON`, default `15 3 * * *`). Running it from a home IP with no
  proxy will likely get you rate-limited or blocked by those sites — you were
  warned. Configure `SCRAPER_PROXY_URL` (Bright Data / Oxylabs / your own).
- **On-demand:** `POST /api/scrape` with `{}` (full crawl) or
  `{ "source": "ddproperty", "regionId": "huahin" }` (one run). The **Run
  scrapers now** button in the header does the full crawl.
- **Test selectors:** `npm --workspace server run scrape:test -- kaidee chiangmai`

Selectors will rot — treat the adapters as a starting point you maintain.

---

## Scoring

`client/src/lib/scoring.ts` — seven factors, each normalised to 0–100:

`budget fit`, `value vs appraisal`, `nature`, `facilities`
(hospital 50% / mall 30% / market 20%), `Bangkok access`, `investment`
(area trend 50% / value 30% / rental yield 20%), `land size`.

`total = Σ(weight × factor) / Σ weight`. Weights are sliders in the left
panel (defaults 15/15/20/20/15/10/5) and are saved into the Excel export.

---

## Excel export

`client/src/lib/excel.ts` (SheetJS). One click produces
`retirement-land-<date>.xlsx` with sheets:
**All results** (every filtered parcel, ranked), **Comparison** (your selected
parcels), **Scoring setup** (weights + budget), **Duplicate groups**
(same parcel across sites, cheapest flagged).

---

## Project layout

```
retirement-land-finder/
├─ client/                 Vite + React + TypeScript + Leaflet (OSM)
│  └─ src/
│     ├─ components/        Header, Filters, WeightsPanel, MapPanel,
│     │                     ListingList, ListingDetail, CompareModal
│     ├─ lib/               scoring.ts, excel.ts, format.ts
│     ├─ store.ts           zustand state
│     └─ derived.ts         filter + sort + score pipeline
└─ server/                  Express + TypeScript (tsx, no build step)
   └─ src/
      ├─ appraisal/         treasury.ts (LIVE), index.ts (+ heuristic)
      ├─ scrapers/          ddproperty / kaidee / baania + runner
      ├─ seed/generate.ts   deterministic sample listings
      ├─ enrich.ts          distances + appraisal + dedup → EnrichedListing
      ├─ dedup.ts           cross-site "same parcel" grouping
      ├─ crawler.ts         node-cron scheduled crawl (off by default)
      └─ routes.ts          /api/*
```

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/regions` | regions + POIs |
| GET | `/api/listings` | enriched listings (`?refresh=1` to rebuild) |
| GET | `/api/listings/:id` | one enriched listing |
| GET | `/api/meta` | store + crawler status |
| POST | `/api/appraisal` | live Treasury appraisal for `{lat,lng,landAreaSqm}` |
| POST | `/api/scrape` | run scrapers (`{}` = full, or `{source,regionId}`) |
| POST | `/api/admin/reset-seed` | wipe store back to sample data |

---

## Notes & disclaimers

- Distances are straight-line; "drive time" is a rough factor on top. Not routing.
- Appraisal figures are the government's, not a market valuation. Sample-listing
  prices are synthetic.
- Respect each listing site's Terms of Service. Keep scraping low-volume and
  on-demand; a scheduled crawler against these sites from an un-proxied IP is a
  good way to get blocked.
- Not investment advice.
