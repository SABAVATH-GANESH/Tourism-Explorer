import { env } from 'cloudflare:workers';
import { detectCategory, getCategoryByKey, DEFAULT_CATEGORY } from './categories.js';

const USER_AGENT = 'TourismExplorerHackathon/1.0 (https://github.com/your-username; your-email@example.com)';

const cache = new Map();
const TTL = 3 * 60 * 60 * 1000;
const RADII = [5000, 15000, 30000];
const BLOCKED = /accommodation|catering|commercial|service|conference_centre/;

const toRad = d => (d * Math.PI) / 180;
function km(lat1, lon1, lat2, lon2) {
  const x = Math.sin(toRad(lat2 - lat1) / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(toRad(lon2 - lon1) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(x));
}

async function fetchJson(url, ms = 6000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' },
    });
    if (!r.ok) throw new Error(`HTTP ${r.status} from ${new URL(url).hostname}`);
    return await r.json();
  } finally {
    clearTimeout(timer);
  }
}

// One Geoapify request: 10 second limit, and one retry on timeout or network errors.
async function geoapifyPlaces(categories, lat, lon, radius) {
  const url =
    `https://api.geoapify.com/v2/places?categories=${categories}` +
    `&filter=circle:${lon},${lat},${radius}&limit=20&apiKey=${env.GEOAPIFY_KEY}`;
  try {
    const json = await fetchJson(url, 10000);
    return json.features || [];
  } catch (e) {
    if (String(e.message).includes('HTTP 4')) throw e; // client errors: retrying will not help
    console.warn('Geoapify slow or unreachable, retrying once:', e.message);
    const json = await fetchJson(url, 10000);
    return json.features || [];
  }
}

// If Geoapify rejects a category list (HTTP 400), try each category alone,
// skip the invalid ones, and fall back to general sights if none are valid.
async function loadFeatures(categories, lat, lon, radius) {
  try {
    return await geoapifyPlaces(categories, lat, lon, radius);
  } catch (e) {
    if (!String(e.message).includes('HTTP 400')) throw e;

    const list = categories.split(',');
    console.warn('Geoapify rejected categories:', categories, '- trying one by one');
    const results = await Promise.allSettled(
      list.map(c => geoapifyPlaces(c, lat, lon, radius))
    );

    const features = [];
    let anyValid = false;
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') {
        anyValid = true;
        features.push(...r.value);
      } else {
        console.warn('Invalid category skipped:', list[i]);
      }
    });

    if (!anyValid) {
      console.warn('No valid category, falling back to', DEFAULT_CATEGORY.geoapify);
      return geoapifyPlaces(DEFAULT_CATEGORY.geoapify, lat, lon, radius);
    }
    return features;
  }
}

function normalise(feature, lat, lon) {
  const p = feature.properties;
  const raw = p.datasource?.raw || {};
  return {
    id: p.place_id,
    name: p.name,
    address: p.address_line2 || p.formatted || '',
    lat: p.lat,
    lon: p.lon,
    categories: p.categories || [],
    wikipedia: raw.wikipedia || null,
    hasWiki: Boolean(raw.wikidata || raw.wikipedia),
    distanceKm: +km(lat, lon, p.lat, p.lon).toFixed(1),
  };
}

// Keep named, non-commercial places and remove duplicates.
function cleanPlaces(features, lat, lon) {
  const seen = new Set();
  return features
    .filter(f => f.properties.name)
    .filter(f => !(f.properties.categories || []).some(c => BLOCKED.test(c)))
    .map(f => normalise(f, lat, lon))
    .filter(p => {
      const k = p.name.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
}

export function registerRoutes(app) {
  app.get('/api/places', async (req, res) => {
    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return res.status(400).json({ error: 'lat and lon are required' });
    }

    // A chip click sends ?cat=..., otherwise the category comes from the query text.
    const cat = req.query.cat
      ? getCategoryByKey(String(req.query.cat))
      : detectCategory(String(req.query.q || ''));

    const cacheKey = `${lat.toFixed(2)}|${lon.toFixed(2)}|${cat.key}`;
    const hit = cache.get(cacheKey);
    if (hit && Date.now() - hit.t < TTL) return res.json(hit.data);

    try {
      let places = [];
      let usedRadius = RADII[0];

      for (const r of RADII) {
        let found;
        try {
          const features = await loadFeatures(cat.geoapify, lat, lon, r);
          found = cleanPlaces(features, lat, lon);
        } catch (e) {
          // A wider search failed, but a smaller one already found places: use those.
          if (places.length) {
            console.warn('Wider search failed, using the smaller radius:', e.message);
            break;
          }
          throw e;
        }
        places = found;
        usedRadius = r;
        if (places.length >= 5) break;
      }

      places.sort((a, b) =>
        (Number(b.hasWiki) - Number(a.hasWiki)) || (a.distanceKm - b.distanceKm));
      places = places.slice(0, 20);

      // Short descriptions for the top places (best effort).
      await Promise.allSettled(places.slice(0, 8).map(async p => {
        if (!p.wikipedia) return;
        try {
          const [lang, ...rest] = p.wikipedia.split(':');
          const title = rest.join(':').replace(/ /g, '_');
          const s = await fetchJson(
            `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
            4000
          );
          if (s.extract) p.description = s.extract;
        } catch (e) {
          console.warn('wiki skipped for', p.name, e.message);
        }
      }));

      const data = { category: cat.key, radiusKm: usedRadius / 1000, places };
      cache.set(cacheKey, { t: Date.now(), data });
      res.json(data);
    } catch (e) {
      console.error('places error:', e.message);
      res.status(502).json({ error: 'Places service unavailable' });
    }
  });

  app.get('/api/weather', async (req, res) => {
    try {
      const { lat, lon } = req.query;
      const j = await fetchJson(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
        `&daily=weathercode,temperature_2m_max,precipitation_probability_max&timezone=auto`
      );
      res.json(j.daily);
    } catch (e) {
      console.error('weather error:', e.message);
      res.status(502).json({ error: 'Weather unavailable' });
    }
  });
}