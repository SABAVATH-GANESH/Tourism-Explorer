import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from '@mui/material/styles';
import { readSearchData } from './lib';
import { planDay, describeWeather, bestDayIndex, dayName, directionsUrl } from './helpers';

const CHIPS = [
  { key: 'all', label: 'All' },
  { key: 'museums', label: 'Museums' },
  { key: 'temples', label: 'Temples' },
  { key: 'forts', label: 'Forts' },
  { key: 'parks', label: 'Parks' },
  { key: 'viewpoints', label: 'Viewpoints' },
  { key: 'historic', label: 'Historic' },
];

const CSS = `
.te{font-family:system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:var(--te-fg);width:100%;box-sizing:border-box}
.te *{box-sizing:border-box}
.te-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap}
.te-title{margin:0;font-size:18px;font-weight:700;line-height:1.25}
.te-sub{font-size:12px;color:var(--te-muted);margin-top:2px;min-height:15px}
.te-wx{font-size:12px;background:var(--te-card);border:1px solid var(--te-line);border-radius:12px;padding:6px 10px}
.te-wxbest{color:var(--te-muted);margin-top:2px}
.te-chips{display:flex;gap:6px;overflow-x:auto;padding:10px 0 4px;scrollbar-width:none}
.te-chips::-webkit-scrollbar{display:none}
.te-chip{flex:0 0 auto;border:1px solid var(--te-line);background:transparent;color:var(--te-fg);border-radius:999px;padding:5px 12px;font-size:12px;cursor:pointer;font-family:inherit}
.te-chip[aria-pressed="true"]{background:var(--te-accent);border-color:var(--te-accent);color:var(--te-accent-fg);font-weight:600}
.te-tabs{display:flex;gap:4px;margin:8px 0 12px;border-bottom:1px solid var(--te-line)}
.te-tab{background:none;border:0;color:var(--te-muted);padding:8px 12px;font-size:13px;cursor:pointer;border-bottom:2px solid transparent;font-family:inherit}
.te-tab[aria-selected="true"]{color:var(--te-fg);border-bottom-color:var(--te-accent);font-weight:600}
.te-hero{display:grid;gap:8px;margin-bottom:10px}
.te-list{display:grid;gap:6px}
.te-item{border:1px solid var(--te-line);background:var(--te-card);border-radius:12px;overflow:hidden}
.te-item--hero{border-color:var(--te-line)}
.te-itemhead{display:flex;gap:10px;align-items:flex-start;width:100%;background:none;border:0;color:inherit;text-align:left;padding:10px 12px;cursor:pointer;font-family:inherit}
.te-itemhead:hover .te-name{color:var(--te-accent)}
.te-rank{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:var(--te-accent);color:var(--te-accent-fg);font-size:12px;font-weight:700;flex:0 0 22px}
.te-itemmain{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1}
.te-name{font-size:14px;font-weight:600;line-height:1.3}
.te-meta{font-size:12px;color:var(--te-muted)}
.te-desc{font-size:12.5px;line-height:1.45;margin-top:3px}
.te-clamp{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.te-chev{color:var(--te-muted);font-size:12px;padding-top:3px}
.te-actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:0 12px 12px 44px}
.te-addr{flex-basis:100%;font-size:12px;color:var(--te-muted)}
.te-btn{display:inline-block;border:1px solid var(--te-accent);color:var(--te-accent);background:transparent;border-radius:999px;padding:5px 12px;font-size:12px;cursor:pointer;text-decoration:none;font-family:inherit}
.te-btn:hover{background:var(--te-accent);color:var(--te-accent-fg)}
.te-note{font-size:13px;color:var(--te-muted);padding:14px 2px;line-height:1.5}
.te-sel{margin-top:10px;border:1px solid var(--te-line);background:var(--te-card);border-radius:12px;padding:10px 12px;display:flex;flex-direction:column;gap:6px;align-items:flex-start}
.te-plansum{font-size:12px;color:var(--te-muted);margin-bottom:8px}
.te-slot{margin-top:14px}
.te-slotlabel{font-size:13px;font-weight:700;margin-bottom:6px}
.te-leg{font-size:11.5px;color:var(--te-muted);padding:4px 0 4px 8px;border-left:2px dashed var(--te-line);margin-left:10px}
.te-stop{display:flex;gap:10px;align-items:flex-start;padding:6px 0}
.te-stop .te-btn{margin-top:4px}
`;

// Tracks the component's own width so it adapts to sidebar vs mainline.
function useWidth(ref) {
  const [w, setW] = useState(400);
  useEffect(() => {
    if (!ref.current || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(entries => setW(entries[0].contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return w;
}

// Lightweight SVG map: no libraries, no tiles, works in a narrow sidebar.
function MapView({ items, centre, selectedId, onSelect, route }) {
  const W = 320, H = 230, PAD = 26;
  const pts = [...items];
  if (centre && centre.lat != null) pts.push(centre);
  if (!pts.length) return null;

  const lats = pts.map(p => p.lat);
  const lons = pts.map(p => p.lon);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLon = Math.min(...lons), maxLon = Math.max(...lons);
  const kx = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  const spanX = Math.max((maxLon - minLon) * kx, 0.0005);
  const spanY = Math.max(maxLat - minLat, 0.0005);
  const scale = Math.min((W - 2 * PAD) / spanX, (H - 2 * PAD) / spanY);
  const ox = (W - spanX * scale) / 2;
  const oy = (H - spanY * scale) / 2;
  const project = p => ({ x: ox + (p.lon - minLon) * kx * scale, y: oy + (maxLat - p.lat) * scale });

  const line = route && route.length > 1
    ? route.map(p => { const q = project(p); return `${q.x},${q.y}`; }).join(' ')
    : null;
  const c = centre && centre.lat != null ? project(centre) : null;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Map of places"
      style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 12, background: 'var(--te-map)', border: '1px solid var(--te-line)' }}>
      {[1, 2, 3].map(i => (
        <g key={i} stroke="var(--te-line)" strokeWidth="0.5" opacity="0.6">
          <line x1={(W / 4) * i} y1="0" x2={(W / 4) * i} y2={H} />
          <line x1="0" y1={(H / 4) * i} x2={W} y2={(H / 4) * i} />
        </g>
      ))}
      {line && <polyline points={line} fill="none" stroke="var(--te-accent)" strokeWidth="2" strokeDasharray="5 4" />}
      {c && (
        <g>
          <title>City centre</title>
          <rect x={c.x - 5} y={c.y - 5} width="10" height="10" transform={`rotate(45 ${c.x} ${c.y})`}
            fill="none" stroke="var(--te-muted)" strokeWidth="2" />
        </g>
      )}
      {items.map(p => {
        const q = project(p);
        const sel = p.id === selectedId;
        return (
          <g key={p.id} onClick={() => onSelect(p.id)} style={{ cursor: 'pointer' }}
            role="button" tabIndex={0} aria-label={p.name}
            onKeyDown={e => { if (e.key === 'Enter') onSelect(p.id); }}>
            <title>{p.name}</title>
            <circle cx={q.x} cy={q.y} r={sel ? 13 : 11} fill={sel ? 'var(--te-accent)' : 'var(--te-pin)'}
              stroke="var(--te-bg-ring)" strokeWidth="2" />
            <text x={q.x} y={q.y + 4} textAnchor="middle" fontSize="11" fontWeight="700"
              fill={sel ? 'var(--te-accent-fg)' : 'var(--te-pin-fg)'}>{p.n}</text>
          </g>
        );
      })}
    </svg>
  );
}

function PlaceItem({ p, n, hero, open, onToggle, onShowMap }) {
  return (
    <div className={`te-item${hero ? ' te-item--hero' : ''}`}>
      <button className="te-itemhead" onClick={onToggle} aria-expanded={open}>
        <span className="te-rank">{n}</span>
        <span className="te-itemmain">
          <span className="te-name">{p.name}</span>
          <span className="te-meta">{p.distanceKm} km from centre</span>
          {(hero || open) && p.description && (
            <span className={`te-desc${open ? '' : ' te-clamp'}`}>{p.description}</span>
          )}
        </span>
        <span className="te-chev">{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div className="te-actions">
          {p.address && <div className="te-addr">📍 {p.address}</div>}
          <a className="te-btn" href={directionsUrl(p)} target="_blank" rel="noopener noreferrer">Directions</a>
          <button className="te-btn" onClick={onShowMap}>Show on map</button>
        </div>
      )}
    </div>
  );
}

function NewComponent(props) {
  const API_URL = process.env.NODE_ENV === 'production'
    ? (props.deployedBackendURL ? props.deployedBackendURL : '')
    : import.meta.env.VITE_API_URL;

  const s = readSearchData(props);
  const theme = useTheme();
  const dark = theme.palette.mode === 'dark';
  const rootRef = useRef(null);
  const wide = useWidth(rootRef) >= 560;

  const [cat, setCat] = useState(null);          // null = category from the query text
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading');
  const [tick, setTick] = useState(0);
  const [tab, setTab] = useState('list');
  const [openId, setOpenId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [weather, setWeather] = useState(null);
  const notified = useRef(false);

  // Places
  useEffect(() => {
    if (s.lat == null || s.lon == null) { setStatus('noplace'); return undefined; }
    let live = true;
    setStatus('loading');
    const url = `${API_URL}/api/places?lat=${s.lat}&lon=${s.lon}&q=${encodeURIComponent(s.query)}` +
      (cat ? `&cat=${cat}` : '');
    fetch(url)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('bad response'))))
      .then(d => {
        if (!live) return;
        setData(d);
        setOpenId(null);
        setSelectedId(null);
        setStatus(d.places.length ? 'ok' : 'empty');
      })
      .catch(() => { if (live) setStatus('error'); });
    return () => { live = false; };
  }, [s.lat, s.lon, s.query, cat, tick]);

  // Weather (optional: the component works without it)
  useEffect(() => {
    if (s.lat == null || s.lon == null) return undefined;
    let live = true;
    fetch(`${API_URL}/api/weather?lat=${s.lat}&lon=${s.lon}`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('no weather'))))
      .then(w => { if (live) setWeather(w); })
      .catch(() => {});
    return () => { live = false; };
  }, [s.lat, s.lon]);

  // Tell hyperDart we are ready (once) after the first real content or message.
  useEffect(() => {
    if (status !== 'loading' && !notified.current) {
      notified.current = true;
      props?.messageHandlers?.componentLoaded();
    }
  }, [status]);

  const places = data?.places || [];
  const plan = useMemo(() => planDay(places), [data]);
  const activeCat = cat ?? data?.category ?? 'all';
  const activeLabel = CHIPS.find(c => c.key === activeCat)?.label || 'Places';
  const selected = places.find(p => p.id === selectedId);

  const vars = {
    '--te-fg': theme.palette.text.primary,
    '--te-muted': theme.palette.text.secondary,
    '--te-card': dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.035)',
    '--te-line': dark ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.13)',
    '--te-accent': dark ? '#ffb347' : '#e8590c',
    '--te-accent-fg': dark ? '#1a1a1a' : '#ffffff',
    '--te-map': dark ? '#1c2733' : '#eaf1f7',
    '--te-pin': dark ? '#74c0fc' : '#1c7ed6',
    '--te-pin-fg': dark ? '#0b1a26' : '#ffffff',
    '--te-bg-ring': dark ? '#1c2733' : '#ffffff',
  };

  let wx = null;
  if (weather?.time?.length) {
    const d0 = describeWeather(weather.weathercode[0]);
    const best = bestDayIndex(weather);
    wx = (
      <div className="te-wx" title={d0.text}>
        {d0.icon} {Math.round(weather.temperature_2m_max[0])}°C · {weather.precipitation_probability_max[0] ?? 0}% rain
        <div className="te-wxbest">Best day to go: {dayName(weather.time[best], best)}</div>
      </div>
    );
  }

  const showOnMap = id => { setSelectedId(id); setTab('map'); };

  let body;
  if (status === 'loading') {
    body = <div className="te-note">Finding what's worth seeing in {s.place}…</div>;
  } else if (status === 'noplace') {
    body = <div className="te-note">We couldn't work out the location for this search.</div>;
  } else if (status === 'error') {
    body = (
      <div className="te-note">
        Couldn't load places right now.{' '}
        <button className="te-btn" onClick={() => setTick(t => t + 1)}>Retry</button>
      </div>
    );
  } else if (status === 'empty') {
    body = (
      <div className="te-note">
        No {activeLabel === 'All' ? 'places' : activeLabel.toLowerCase()} found near {s.place}.{' '}
        {activeCat !== 'all' && <button className="te-btn" onClick={() => setCat('all')}>Show all places</button>}
      </div>
    );
  } else {
    body = (
      <>
        <div className="te-tabs" role="tablist">
          {[['list', 'List'], ['map', 'Map'], ['plan', 'Plan my day']].map(([k, label]) => (
            <button key={k} role="tab" aria-selected={tab === k} className="te-tab" onClick={() => setTab(k)}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'list' && (
          <>
            <div className="te-hero" style={{ gridTemplateColumns: wide ? 'repeat(3, minmax(0, 1fr))' : '1fr' }}>
              {places.slice(0, 3).map((p, i) => (
                <PlaceItem key={p.id} p={p} n={i + 1} hero open={openId === p.id}
                  onToggle={() => setOpenId(openId === p.id ? null : p.id)}
                  onShowMap={() => showOnMap(p.id)} />
              ))}
            </div>
            <div className="te-list">
              {places.slice(3).map((p, i) => (
                <PlaceItem key={p.id} p={p} n={i + 4} open={openId === p.id}
                  onToggle={() => setOpenId(openId === p.id ? null : p.id)}
                  onShowMap={() => showOnMap(p.id)} />
              ))}
            </div>
          </>
        )}

        {tab === 'map' && (
          <>
            <MapView items={places.map((p, i) => ({ ...p, n: i + 1 }))}
              centre={{ lat: s.lat, lon: s.lon }} selectedId={selectedId} onSelect={setSelectedId} />
            {selected ? (
              <div className="te-sel">
                <div className="te-name">{selected.name}</div>
                <div className="te-meta">{selected.distanceKm} km from centre</div>
                {selected.description && <div className="te-desc te-clamp">{selected.description}</div>}
                <a className="te-btn" href={directionsUrl(selected)} target="_blank" rel="noopener noreferrer">Directions</a>
              </div>
            ) : (
              <div className="te-note">Tap a numbered pin to see the place. The diamond is the city centre.</div>
            )}
          </>
        )}

        {tab === 'plan' && (
          <>
            <div className="te-plansum">
              {plan.stops.length} stops · about {plan.totalKm} km between stops. Drive times are rough estimates.
            </div>
            <MapView items={plan.stops} centre={{ lat: s.lat, lon: s.lon }}
              selectedId={null} onSelect={() => {}} route={plan.stops} />
            {plan.slots.map(slot => (
              <div key={slot.label} className="te-slot">
                <div className="te-slotlabel">{slot.icon} {slot.label}</div>
                {slot.items.map(p => (
                  <div key={p.id}>
                    {p.n > 1 && <div className="te-leg">↓ {p.legKm} km · about {p.legMin} min by car</div>}
                    <div className="te-stop">
                      <span className="te-rank">{p.n}</span>
                      <div>
                        <div className="te-name">{p.name}</div>
                        <a className="te-btn" href={directionsUrl(p)} target="_blank" rel="noopener noreferrer">Directions</a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </>
        )}
      </>
    );
  }

  return (
    <div className="te" ref={rootRef} style={vars}>
      <style>{CSS}</style>
      <div className="te-head">
        <div>
          <h2 className="te-title">Worth seeing in {s.place}</h2>
          <div className="te-sub">
            {status === 'ok'
              ? `${places.length} ${activeLabel === 'All' ? 'places' : activeLabel.toLowerCase()} within ${data.radiusKm} km`
              : ''}
          </div>
        </div>
        {wx}
      </div>

      <div className="te-chips" role="group" aria-label="Categories">
        {CHIPS.map(c => (
          <button key={c.key} className="te-chip" aria-pressed={activeCat === c.key} onClick={() => setCat(c.key)}>
            {c.label}
          </button>
        ))}
      </div>

      {body}
    </div>
  );
}

export default NewComponent;