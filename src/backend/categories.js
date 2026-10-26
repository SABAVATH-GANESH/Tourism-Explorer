// Maps words in the user's query to Geoapify place categories.
// To support a new kind of place, add one line here.
// If a category name is invalid, the backend skips it and logs a warning.
export const CATEGORY_RULES = [
  { key: 'museums',    test: /museum/i,                      geoapify: 'entertainment.museum' },
  { key: 'temples',    test: /temple|shrine|mosque|church/i, geoapify: 'tourism.sights.place_of_worship' },
  { key: 'forts',      test: /fort|castle/i,                 geoapify: 'tourism.sights.fort,tourism.sights.castle' },
  { key: 'parks',      test: /park|garden/i,                 geoapify: 'leisure.park' },
  { key: 'viewpoints', test: /viewpoint|view point/i,        geoapify: 'tourism.attraction.viewpoint' },
  { key: 'historic',   test: /monument|historic|heritage/i,  geoapify: 'tourism.sights.memorial,tourism.sights.archaeological_site,tourism.sights.ruines' },
];

export const DEFAULT_CATEGORY = { key: 'all', geoapify: 'tourism.sights' };

// Category chosen from the words in the search query.
export function detectCategory(query = '') {
  return CATEGORY_RULES.find(r => r.test.test(query)) || DEFAULT_CATEGORY;
}

// Category chosen by clicking a chip in the UI.
export function getCategoryByKey(key = '') {
  return CATEGORY_RULES.find(r => r.key === key) || DEFAULT_CATEGORY;
}