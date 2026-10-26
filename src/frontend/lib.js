// Finds the first value stored under `key` anywhere inside `obj`.
function findKey(obj, key, depth = 0, seen = new Set()) {
  if (!obj || typeof obj !== 'object' || depth > 6 || seen.has(obj)) return undefined;
  seen.add(obj);
  if (key in obj && obj[key] != null) return obj[key];
  const values = Array.isArray(obj) ? obj : Object.values(obj);
  for (const v of values) {
    if (typeof v === 'function') continue;
    const found = findKey(v, key, depth + 1, seen);
    if (found !== undefined) return found;
  }
  return undefined;
}

// Reads the place, coordinates and query from whatever hyperDart passes in.
// Works whether searchData is an array, an object, or nested inside other props.
export function readSearchData(input) {
  const geo = findKey(input, 'geo') || {};
  const entities = findKey(input, 'entities');
  const entity = Array.isArray(entities) ? entities[0] : undefined;
  const query = findKey(input, 'query');
  const view = findKey(input, 'suggestedPlace');
  return {
    query: typeof query === 'string' ? query : '',
    place: geo.city || entity?.word || 'this place',
    lat: geo.lat,
    lon: geo.long,
    view: typeof view === 'string' ? view : 'mainline',
  };
}

// Short text version of what the component received, for debugging.
export function debugDump(input) {
  try {
    const keys = Object.keys(input || {});
    const text = JSON.stringify(input, (k, v) => (typeof v === 'function' ? '[fn]' : v));
    return { keys, text: (text || '').slice(0, 700) };
  } catch {
    return { keys: Object.keys(input || {}), text: '(could not print)' };
  }
}