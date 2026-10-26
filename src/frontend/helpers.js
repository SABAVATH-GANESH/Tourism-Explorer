const toRad = d => (d * Math.PI) / 180;

export function distKm(lat1, lon1, lat2, lon2) {
  const x = Math.sin(toRad(lat2 - lat1) / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(toRad(lon2 - lon1) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(x));
}

export function directionsUrl(p) {
  return `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}`;
}

// Day plan: take the best 6 places, order them by nearest neighbour,
// then split them into morning / afternoon / evening.
export function planDay(places) {
  const pool = places.slice(0, 6);
  if (!pool.length) return { slots: [], stops: [], totalKm: 0 };

  const route = [pool[0]];
  const left = pool.slice(1);
  while (left.length) {
    const last = route[route.length - 1];
    let best = 0;
    let bestDist = Infinity;
    left.forEach((p, i) => {
      const d = distKm(last.lat, last.lon, p.lat, p.lon);
      if (d < bestDist) { bestDist = d; best = i; }
    });
    route.push(left.splice(best, 1)[0]);
  }

  let totalKm = 0;
  const stops = route.map((p, i) => {
    const legKm = i === 0 ? 0 : distKm(route[i - 1].lat, route[i - 1].lon, p.lat, p.lon);
    totalKm += legKm;
    return {
      ...p,
      n: i + 1,
      legKm: +legKm.toFixed(1),
      legMin: i === 0 ? 0 : Math.max(3, Math.round(legKm * 3)), // rough city driving estimate
    };
  });

  const size = Math.ceil(stops.length / 3);
  const slots = [
    { label: 'Morning',   icon: '🌅', items: stops.slice(0, size) },
    { label: 'Afternoon', icon: '☀️', items: stops.slice(size, size * 2) },
    { label: 'Evening',   icon: '🌇', items: stops.slice(size * 2) },
  ].filter(s => s.items.length);

  return { slots, stops, totalKm: +totalKm.toFixed(1) };
}

// Open-Meteo uses WMO weather codes.
export function describeWeather(code) {
  if (code === 0) return { icon: '☀️', text: 'Clear' };
  if (code <= 3) return { icon: '⛅', text: 'Partly cloudy' };
  if (code === 45 || code === 48) return { icon: '🌫️', text: 'Foggy' };
  if (code >= 51 && code <= 57) return { icon: '🌦️', text: 'Drizzle' };
  if (code >= 61 && code <= 67) return { icon: '🌧️', text: 'Rain' };
  if (code >= 71 && code <= 77) return { icon: '❄️', text: 'Snow' };
  if (code >= 80 && code <= 82) return { icon: '🌦️', text: 'Showers' };
  if (code >= 85 && code <= 86) return { icon: '❄️', text: 'Snow showers' };
  if (code >= 95) return { icon: '⛈️', text: 'Thunderstorm' };
  return { icon: '🌡️', text: 'Weather' };
}

// Index (0-6) of the day with the lowest chance of rain.
export function bestDayIndex(weather) {
  const rain = (weather?.precipitation_probability_max || []).slice(0, 7);
  let best = 0;
  let bestValue = Infinity;
  rain.forEach((v, i) => {
    const x = v ?? 100;
    if (x < bestValue) { bestValue = x; best = i; }
  });
  return best;
}

export function dayName(dateStr, index) {
  if (index === 0) return 'today';
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString(undefined, { weekday: 'short' });
}