# Tourism Explorer — a hyperDart component

Search "things to do in Paris" or "museums in Delhi" and see what is actually worth visiting, at a glance, instead of a list of links to long travel articles.

Built for the hyperDart Tourism Explorer hackathon with React + Vite on the frontend and Express (running as a Cloudflare Worker) on the backend.

- GitHub: https://github.com/SABAVATH-GANESH/Tourism-Explorer
- Demo video: https://youtu.be/LKAc02qVBto?si=35dbgFkeYHVQYBW_

---

## 1. The idea

Planning a trip starts with a broad question. A good answer needs to:

1. Understand the place and the intent (all sights, or only museums/temples).
2. Show real attractions, not restaurants, hotels or shops.
3. Answer in about 3 seconds, then let people dig deeper.

So the component is built in two layers:

| Layer | What the user sees |
|---|---|
| At a glance | "Top 3 must-sees" cards, a weather chip with the best day to go, category chips pre-selected from the query |
| Dig deeper | Expandable place cards (description, address, directions), a List / Map / Plan my day switch |

## 2. Features

- Understands natural-language queries and picks the category from the query text (museums, temples, forts, parks, viewpoints, historic sites).
- Category chips let the user switch category without re-searching.
- Filters out accommodation, catering, commercial and service places, so results are tourist places.
- Short Wikipedia descriptions for the top places.
- Weather for the next days from Open-Meteo, plus a "Best day to go" hint (lowest rain chance).
- Lightweight SVG map (numbered pins, city-centre marker). Works in the narrow sidebar.
- "Plan my day": groups the top stops into morning / afternoon / evening, orders them by nearest neighbour, shows distance and rough drive time between stops.
- Directions deep link (Google Maps, no key needed).
- Adaptive search radius for small towns (5 km, then 15 km, then 30 km).
- Layout adapts to its own width (sidebar vs mainline) and follows the host's light/dark theme.
- Handles loading, API error (with Retry), empty results, and missing location.

## 3. System design

### 3.1 Architecture

```
 User searches "museums in Delhi"
            |
            v
 hyperDart matches keywords / regex  (hyperdart.config.js)
            |   resolves "Delhi" as HD_LOCATION, loads the component
            v
 +-----------------------------+
 |  Frontend (React + Vite)    |   never sees the API key
 |  readSearchData() -> lat,   |
 |  lon, query, place name     |
 +--------------+--------------+
                | GET /api/places?lat&lon&q[&cat]
                | GET /api/weather?lat&lon
                v
 +-----------------------------+
 |  Backend (Express in a      |   holds GEOAPIFY_KEY
 |  Cloudflare Worker)         |
 |  detect category            |
 |  -> Geoapify Places         |
 |  -> filter, dedupe, rank    |
 |  -> Wikipedia summaries     |
 |  -> Open-Meteo weather      |
 |  -> in-memory cache         |
 +-----------------------------+
```

### 3.2 Why this shape

| Decision | Why | How |
|---|---|---|
| Separate backend | Anything in frontend code is visible to every user. The Geoapify key must stay private. | Browser only calls our `/api/*` routes. The key is read from `env.GEOAPIFY_KEY` in the Worker (`.dev.vars` locally). |
| One category table | The category is not resolved by hyperDart. A single table also makes "add a query pattern" a one-line change. | `src/backend/categories.js` maps regexes on the query text to Geoapify categories. A chip click sends `cat=...`, which takes priority over the query text. |
| Exclude by category name | Accuracy matters: no restaurants, hotels or shops as primary results. | Drop any place whose categories match `accommodation\|catering\|commercial\|service\|conference_centre`, and any place without a name. |
| Rank by Wikipedia/Wikidata tag, then distance | A simple, explainable proxy for "notable". | Places with a wiki tag first, then closest to the centre. This is a heuristic, not a popularity score. |
| Adaptive radius | "Kurukshetra" or a small town may have few places within 5 km. | Try 5 km, then 15 km, then 30 km, and stop once at least 5 places survive filtering. |
| Best-effort enrichment | Descriptions and weather are nice-to-have. | Wikipedia and weather failures are swallowed (`Promise.allSettled`, separate weather request). The list still renders. |
| Category fallback | A wrong Geoapify category name returns HTTP 400. | On a 400, retry each category alone, skip invalid ones (logged), and fall back to `tourism.sights`. |
| Cache | Protects the free API quota and speeds up repeat searches. | In-memory `Map` keyed by `lat\|lon\|category`, 3-hour TTL. |
| SVG map instead of a tile map | No extra library, no tile or stylesheet loading problems after publishing, fits a narrow sidebar. | Coordinates are scaled into the box, with longitude corrected by cos(latitude) so shapes are not stretched. |
| Width-based layout | The component lives in both a ~350px sidebar and a wide mainline. Viewport media queries do not know that. | `ResizeObserver` on the component root. Wide means the top 3 sit side by side. |
| Theme from host | Must work in light and dark. | Colours are CSS variables derived from the host's MUI theme. |

### 3.3 Request flow in detail

1. **Trigger**: keywords and regexes in `hyperdart.config.js` decide when the component appears. `HD_LOCATION` is replaced by hyperDart with a known city, district, state or country.
2. **Input**: the component gets `searchData` (array or object). `readSearchData()` in `lib.js` searches it defensively for `geo.lat`, `geo.long`, city name, `query` and `suggestedPlace`.
3. **Places request**: frontend calls `/api/places`. The backend picks the category, asks Geoapify for at most 20 places in a circle (longitude first!), then filters, dedupes, ranks and trims to 20.
4. **Enrichment**: for the top 8 places with a Wikipedia tag, fetch a short summary (with a proper User-Agent and a timeout).
5. **Weather request**: separate `/api/weather` call to Open-Meteo (7 days). Frontend shows today and the best day.
6. **Render**: top 3 first, then list / map / day plan. `componentLoaded()` is called once after the first real content.

### 3.4 Day plan algorithm

1. Take the top 6 ranked places.
2. Start at the first, then always move to the nearest unvisited place (nearest-neighbour).
3. Distance uses the haversine formula. Drive time is estimated at about 3 minutes per km.
4. Split the ordered stops into morning / afternoon / evening.

Nearest-neighbour is a fast approximation, not the optimal route.

### 3.5 Failure handling

| Situation | Behaviour |
|---|---|
| No `searchData` / no coordinates | "We couldn't work out the location" message |
| Geoapify error or timeout | Friendly error with Retry button (backend returns 502) |
| Geoapify rejects a category | Per-category retry, then fall back to general sights |
| Nothing found | "No museums found near X" with a "Show all places" button |
| Wikipedia fails for a place | That place simply has no description |
| Weather fails | Weather chip is hidden |

## 4. Data sources

| Source | Used for | Key needed |
|---|---|---|
| Geoapify Places API | Attractions near the searched place | Yes (backend only) |
| Wikipedia REST API | Short descriptions | No |
| Open-Meteo | 7-day weather | No |
| Google Maps URL | Directions deep link | No |

## 5. Libraries

React, Vite, MUI (theme only), Express, Wrangler (Cloudflare Workers). The map, plan and UI are hand-written, with no map or chart library.

## 6. Project structure

```
src/
  backend/
    index.js        Template Express + Worker setup (registerRoutes added)
    routes.js       /api/places and /api/weather, filtering, ranking, cache
    categories.js   Query words -> Geoapify categories
    .dev.vars       Local secret (GEOAPIFY_KEY), never committed
  frontend/
    NewComponent.jsx  The whole UI
    lib.js            readSearchData(): finds place, coords, query
    helpers.js        Haversine, day plan, weather codes, best day
  sandbox/main.jsx    Local test harness
hyperdart.config.js   Triggers, build paths, github + demo video links
searchData.json       Sample data for local testing
```

## 7. Run locally

```bash
npm install
cd src/backend && npm install && cd ../..
```

Create `src/backend/.dev.vars`:

```
GEOAPIFY_KEY=your_key_here
```

Get a free key at https://geoapify.com. Never commit it (it is in `.gitignore`).

```bash
# terminal 1 - backend
cd src/backend
npm start

# terminal 2 - frontend
npm start
```

In the sandbox, try: `Tourist attractions in NYC`, `museums in Delhi`, `best places to visit in Kurukshetra`, `Landmarks in Rome`. Use the sandbox toggles to check Mainline / Sidebar and light / dark. If you change `hyperdart.config.js`, restart the frontend.

## 8. Build and publish

```bash
npm run build
cd src/backend && npm run build && cd ../..
npm version patch
npm publish        # plain publish, runs prepublish validation
```

Create the package in the Partner Portal first. The package name there must match `name` in `package.json`.

## 9. Known limitations

- Drive times are rough estimates, not real routing.
- Nearest-neighbour is not the optimal route.
- The cache is in memory and can reset when the Worker restarts.
- Distances are from the searched city's centre. The user's IP-based location is not used because it is often inaccurate.
- "Temples" maps to places of worship in general.
- Ranking by Wikipedia tag is a heuristic, so notable places without a wiki tag can rank lower.
- Some Geoapify category names may be invalid for certain regions. The fallback hides this from users and logs the skipped names.
